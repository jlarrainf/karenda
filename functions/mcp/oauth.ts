import { createAdminClient, createClient } from "npm:@insforge/sdk@1.5.2";
import { createPersistentMcpProtectionStore, forwardedClientAddress } from "./protections.ts";
import {
  createOpaqueToken,
  decryptSecret,
  encryptSecret,
  hashOpaqueToken,
  intersectGrantedScopes,
  isAllowedRedirectUri,
  matchesRegisteredRedirectUri,
  McpOAuthError,
  parseRequestedScopes,
  verifyPkceS256,
} from "./security.ts";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTHORIZATION_REQUEST_TTL_MS = 10 * 60 * 1000;
const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_OAUTH_BODY_BYTES = 64 * 1024;
const MAX_REDIRECT_URIS = 20;

export interface McpOAuthConfig {
  baseUrl: string;
  functionOrigin: string;
  issuer: string;
  resource: string;
  protectedResourceMetadataUrl: string;
  authorizationMetadataUrl: string;
  consentUrl: string;
  webOrigin: string;
  encryptionKey: string;
}

export interface McpPrincipal {
  ownerId: string;
  scopes: string[];
  accessToken: string;
  clientId: string;
  grantId: string;
}

interface OAuthClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

interface AuthorizationRequestRow {
  id: string;
  client_id: string;
  redirect_uri: string;
  requested_scopes: string[];
  state: string;
  code_challenge: string;
  resource_uri: string;
  owner_id: string | null;
  expires_at: string;
  consumed_at: string | null;
}

interface GrantRow {
  id: string;
  owner_id: string;
  client_id: string;
  scopes: string[];
  insforge_access_token_ciphertext: string;
  insforge_access_token_iv: string;
  insforge_access_expires_at: string;
  revoked_at: string | null;
}

interface AccessTokenRow {
  token_hash: string;
  grant_id: string;
  resource_uri: string;
  expires_at: string;
  revoked_at: string | null;
}

interface RefreshTokenRow {
  token_hash: string;
  grant_id: string;
  family_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export class OAuthHttpError extends Error {
  constructor(
    readonly status: number,
    readonly oauthCode: string,
    message: string,
  ) {
    super(message);
    this.name = "OAuthHttpError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function adminClient() {
  const apiKey = Deno.env.get("API_KEY") ?? "";
  if (!apiKey) {
    throw new OAuthHttpError(
      503,
      "temporarily_unavailable",
      "La conexión segura con Karenda no está disponible.",
    );
  }
  return createAdminClient({ baseUrl: Deno.env.get("INSFORGE_BASE_URL") ?? "", apiKey });
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Pragma", "no-cache");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function oauthError(error: OAuthHttpError): Response {
  return jsonResponse({ error: error.oauthCode, error_description: error.message }, error.status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);
    if (characterCode <= 0x1f || characterCode === 0x7f) return true;
  }
  return false;
}

function decodeAccessTokenExpiry(accessToken: string): number {
  const parts = accessToken.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new OAuthHttpError(401, "invalid_grant", "La sesión de Karenda venció. Vuelve a iniciar sesión.");
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (!Number.isInteger(payload.exp)) throw new Error("Invalid expiry.");
    return payload.exp * 1000;
  } catch {
    throw new OAuthHttpError(401, "invalid_grant", "La sesión de Karenda venció. Vuelve a iniciar sesión.");
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

async function authenticateWebSession(request: Request, baseUrl: string) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    throw new OAuthHttpError(401, "login_required", "Inicia sesión en Karenda para continuar.");
  }

  const client = createClient({ baseUrl, accessToken });
  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user?.id) {
    throw new OAuthHttpError(401, "login_required", "Tu sesión de Karenda venció. Inicia sesión nuevamente.");
  }

  return {
    accessToken,
    userId: data.user.id as string,
    accessExpiresAt: decodeAccessTokenExpiry(accessToken),
  };
}

async function readBoundedText(request: Request): Promise<string> {
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(length) && length > MAX_OAUTH_BODY_BYTES) {
    throw new OAuthHttpError(413, "invalid_request", "La solicitud supera el tamaño permitido.");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_OAUTH_BODY_BYTES) {
        await reader.cancel();
        throw new OAuthHttpError(413, "invalid_request", "La solicitud supera el tamaño permitido.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new OAuthHttpError(400, "invalid_request", "El formato de la solicitud no es válido.");
  }
  return text;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await readBoundedText(request);

  try {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) throw new Error("Expected object.");
    return value;
  } catch {
    throw new OAuthHttpError(400, "invalid_request", "El formato de la solicitud no es válido.");
  }
}

async function readOAuthForm(request: Request): Promise<URLSearchParams> {
  const text = await readBoundedText(request);

  if (request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    try {
      const value: unknown = JSON.parse(text);
      if (!isRecord(value)) throw new Error("Expected object.");
      return new URLSearchParams(
        Object.entries(value).flatMap(([key, entry]) =>
          typeof entry === "string" ? [[key, entry]] : []
        ),
      );
    } catch {
      throw new OAuthHttpError(400, "invalid_request", "El formato de la solicitud no es válido.");
    }
  }

  return new URLSearchParams(text);
}

function parseRedirectUris(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REDIRECT_URIS) {
    throw new OAuthHttpError(400, "invalid_client_metadata", "El cliente no entregó redirecciones válidas.");
  }

  const redirectUris = [...new Set(value.filter((entry): entry is string => typeof entry === "string"))];
  if (
    redirectUris.length !== value.length ||
    redirectUris.some((uri) => !isAllowedRedirectUri(uri))
  ) {
    throw new OAuthHttpError(400, "invalid_client_metadata", "El cliente incluye una redirección no permitida.");
  }
  return redirectUris;
}

async function findClient(clientId: string): Promise<OAuthClientRow> {
  const { data, error } = await adminClient().database
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudo validar el cliente MCP.");
  }
  if (!data) {
    throw new OAuthHttpError(400, "invalid_client", "El cliente MCP no está registrado.");
  }
  return data as OAuthClientRow;
}

async function lookupClientByRedirect(
  clientId: string,
  redirectUri: string,
): Promise<OAuthClientRow> {
  const client = await findClient(clientId);
  if (!matchesRegisteredRedirectUri(redirectUri, client.redirect_uris)) {
    throw new OAuthHttpError(400, "invalid_request", "La dirección de retorno no coincide con el cliente.");
  }
  return client;
}

async function recordAudit(
  grantId: string | null,
  operation: string,
  outcome: "success" | "denied" | "error",
): Promise<void> {
  try {
    await adminClient().database.from("mcp_audit_events").insert([{
      grant_id: grantId,
      operation,
      outcome,
    }]);
  } catch {
    // Audit failures must not change the user's domain operation result.
  }
}

function redirectWithOAuthResult(
  redirectUri: string,
  parameters: Record<string, string>,
): string {
  const redirect = new URL(redirectUri);
  for (const [key, value] of Object.entries(parameters)) redirect.searchParams.set(key, value);
  return redirect.toString();
}

export function buildOAuthMetadata(config: McpOAuthConfig): Record<string, unknown> {
  const scopes = parseRequestedScopes([
    "profile:read",
    "events:read", "events:write", "events:delete",
    "notes:read", "notes:write", "notes:delete",
    "habits:read", "habits:write", "habits:delete",
    "recurring:read", "recurring:write",
    "catalogs:read", "catalogs:write", "catalogs:delete",
    "canvas:read", "canvas:sync", "canvas:review",
    "ai:draft",
  ].join(" "));

  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`,
    registration_endpoint: `${config.issuer}/oauth/register`,
    revocation_endpoint: `${config.issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    scopes_supported: scopes,
  };
}

export function buildProtectedResourceMetadata(
  config: McpOAuthConfig,
): Record<string, unknown> {
  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: parseRequestedScopes([
      "profile:read",
      "events:read", "events:write", "events:delete",
      "notes:read", "notes:write", "notes:delete",
      "habits:read", "habits:write", "habits:delete",
      "recurring:read", "recurring:write",
      "catalogs:read", "catalogs:write", "catalogs:delete",
      "canvas:read", "canvas:sync", "canvas:review",
      "ai:draft",
    ].join(" ")),
    resource_name: "Karenda",
  };
}

export function unauthorizedResourceResponse(config: McpOAuthConfig): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "WWW-Authenticate": `Bearer resource_metadata="${config.protectedResourceMetadataUrl}"`,
  });
  return jsonResponse({
    error: "unauthorized",
    message: "Autoriza Karenda para usar esta conexión MCP.",
  }, 401, headers);
}

export async function registerOAuthClient(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const name = typeof body.client_name === "string" ? body.client_name.trim() : "";
    if (!name || name.length > 120 || containsControlCharacters(name)) {
      throw new OAuthHttpError(400, "invalid_client_metadata", "El nombre del cliente no es válido.");
    }

    const redirectUris = parseRedirectUris(body.redirect_uris);
    const clientId = `karenda_${createOpaqueToken(32)}`;
    const { error } = await adminClient().database.from("mcp_oauth_clients").insert([{
      client_id: clientId,
      client_name: name,
      redirect_uris: redirectUris,
    }]);

    if (error) {
      throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudo registrar el cliente MCP.");
    }

    return jsonResponse({
      client_id: clientId,
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    }, 201);
  } catch (error) {
    if (error instanceof OAuthHttpError) return oauthError(error);
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudo registrar el cliente MCP."));
  }
}

export async function beginAuthorization(
  request: Request,
  config: McpOAuthConfig,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const clientId = params.get("client_id") ?? "";
    const redirectUri = params.get("redirect_uri") ?? "";
    const state = params.get("state") ?? "";
    const challenge = params.get("code_challenge") ?? "";
    const challengeMethod = params.get("code_challenge_method") ?? "";
    const responseType = params.get("response_type") ?? "";
    const resource = params.get("resource") ?? "";

    if (responseType !== "code") {
      throw new OAuthHttpError(400, "unsupported_response_type", "Karenda solo admite el flujo de código de autorización.");
    }
    if (!state || state.length > 512 || containsControlCharacters(state)) {
      throw new OAuthHttpError(400, "invalid_request", "La protección de la solicitud no es válida.");
    }
    if (challengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      throw new OAuthHttpError(400, "invalid_request", "El cliente debe usar PKCE con S256.");
    }
    if (resource !== config.resource) {
      throw new OAuthHttpError(400, "invalid_target", "El recurso solicitado no coincide con Karenda MCP.");
    }

    const client = await lookupClientByRedirect(clientId, redirectUri);
    const scopes = parseRequestedScopes(params.get("scope") ?? "");
    if (scopes.length === 0) {
      throw new OAuthHttpError(400, "invalid_scope", "Selecciona al menos un permiso para continuar.");
    }

    const expiresAt = new Date(Date.now() + AUTHORIZATION_REQUEST_TTL_MS).toISOString();
    const { data, error } = await adminClient().database.from("mcp_authorization_requests")
      .insert([{
        client_id: client.client_id,
        redirect_uri: redirectUri,
        requested_scopes: scopes,
        state,
        code_challenge: challenge,
        resource_uri: config.resource,
        expires_at: expiresAt,
      }])
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudo iniciar la autorización MCP.");
    }

    const consentUrl = new URL(config.consentUrl);
    consentUrl.searchParams.set("request_id", data.id as string);
    return Response.redirect(consentUrl.toString(), 302);
  } catch (error) {
    if (error instanceof OAuthHttpError) return oauthError(error);
    if (error instanceof McpOAuthError) {
      return oauthError(new OAuthHttpError(400, error.code, error.message));
    }
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudo iniciar la autorización MCP."));
  }
}

export async function getConsentRequest(
  request: Request,
  config: McpOAuthConfig,
): Promise<Response> {
  try {
    const session = await authenticateWebSession(request, config.baseUrl);
    const requestId = new URL(request.url).searchParams.get("request_id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
      throw new OAuthHttpError(400, "invalid_request", "La solicitud de autorización no es válida.");
    }

    const { data, error } = await adminClient().database.from("mcp_authorization_requests")
      .select("id, client_id, redirect_uri, requested_scopes, expires_at, owner_id, consumed_at")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !data) {
      throw new OAuthHttpError(404, "invalid_request", "La solicitud de autorización ya no está disponible.");
    }

    const consentRequest = data as AuthorizationRequestRow;
    if (
      Date.parse(consentRequest.expires_at) <= Date.now() ||
      consentRequest.consumed_at ||
      (consentRequest.owner_id && consentRequest.owner_id !== session.userId)
    ) {
      throw new OAuthHttpError(410, "invalid_request", "La solicitud de autorización venció o ya fue utilizada.");
    }

    const client = await findClient(consentRequest.client_id);
    let redirectHost = "aplicación local";
    try {
      const redirect = new URL(consentRequest.redirect_uri);
      redirectHost = redirect.hostname || redirect.protocol.replace(":", "");
    } catch {
      // Redirects were validated during client registration.
    }

    return jsonResponse({
      request_id: consentRequest.id,
      client_name: client.client_name,
      redirect_host: redirectHost,
      requested_scopes: consentRequest.requested_scopes,
      expires_at: consentRequest.expires_at,
    });
  } catch (error) {
    if (error instanceof OAuthHttpError) return oauthError(error);
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudo cargar la autorización MCP."));
  }
}

function extractBearerExpiry(accessToken: string): string {
  const expiry = decodeAccessTokenExpiry(accessToken);
  if (expiry <= Date.now() + 30_000) {
    throw new OAuthHttpError(401, "login_required", "Tu sesión de Karenda está por vencer. Inicia sesión nuevamente.");
  }
  return new Date(expiry).toISOString();
}

async function consumeAuthorizationRequest(
  requestId: string,
  ownerId: string,
): Promise<AuthorizationRequestRow> {
  const { data, error } = await adminClient().database.from("mcp_authorization_requests")
    .select("id, client_id, redirect_uri, requested_scopes, state, code_challenge, resource_uri, owner_id, expires_at, consumed_at")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) {
    throw new OAuthHttpError(404, "invalid_request", "La solicitud de autorización ya no está disponible.");
  }

  const authorizationRequest = data as AuthorizationRequestRow;
  if (
    Date.parse(authorizationRequest.expires_at) <= Date.now() ||
    authorizationRequest.consumed_at ||
    authorizationRequest.owner_id
  ) {
    throw new OAuthHttpError(410, "invalid_request", "La solicitud de autorización venció o ya fue utilizada.");
  }

  const { data: consumed, error: consumeError } = await adminClient().database
    .from("mcp_authorization_requests")
    .update({ owner_id: ownerId, consumed_at: nowIso() })
    .eq("id", requestId)
    .is("owner_id", null)
    .is("consumed_at", null)
    .gt("expires_at", nowIso())
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) {
    throw new OAuthHttpError(409, "invalid_request", "La solicitud ya fue respondida en otra pestaña.");
  }

  return authorizationRequest;
}

export async function decideConsent(
  request: Request,
  config: McpOAuthConfig,
): Promise<Response> {
  let grantId: string | null = null;
  let operation = "consent";
  try {
    const session = await authenticateWebSession(request, config.baseUrl);
    const accessExpiresAt = extractBearerExpiry(session.accessToken);
    const body = await readJsonBody(request);
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const decision = body.decision;
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || (decision !== "approve" && decision !== "deny")) {
      throw new OAuthHttpError(400, "invalid_request", "La decisión de autorización no es válida.");
    }

    const authorizationRequest = await consumeAuthorizationRequest(requestId, session.userId);
    const approvedScopes = decision === "approve"
      ? intersectGrantedScopes(
        authorizationRequest.requested_scopes,
        Array.isArray(body.approved_scopes)
          ? body.approved_scopes.filter((scope): scope is string => typeof scope === "string")
          : [],
      )
      : [];

    if (decision === "deny") {
      operation = "consent_denied";
      await recordAudit(null, operation, "denied");
      return jsonResponse({
        redirect_url: redirectWithOAuthResult(authorizationRequest.redirect_uri, {
          error: "access_denied",
          error_description: "La persona canceló la autorización en Karenda.",
          state: authorizationRequest.state,
          iss: config.issuer,
        }),
      });
    }

    if (!config.encryptionKey) {
      throw new OAuthHttpError(503, "temporarily_unavailable", "La protección de la conexión no está configurada.");
    }

    const encryptedToken = await encryptSecret(session.accessToken, config.encryptionKey);
    const { data: grant, error: grantError } = await adminClient().database.from("mcp_oauth_grants")
      .insert([{
        owner_id: session.userId,
        client_id: authorizationRequest.client_id,
        scopes: approvedScopes,
        insforge_access_token_ciphertext: encryptedToken.ciphertext,
        insforge_access_token_iv: encryptedToken.iv,
        insforge_access_expires_at: accessExpiresAt,
      }])
      .select("id")
      .single();
    if (grantError || !grant?.id) {
      throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudo guardar la autorización.");
    }
    grantId = grant.id as string;

    const code = createOpaqueToken(32);
    const codeHash = await hashOpaqueToken(code);
    const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS).toISOString();
    const { error: codeError } = await adminClient().database.from("mcp_authorization_codes").insert([{
      code_hash: codeHash,
      grant_id: grantId,
      client_id: authorizationRequest.client_id,
      redirect_uri: authorizationRequest.redirect_uri,
      code_challenge: authorizationRequest.code_challenge,
      resource_uri: authorizationRequest.resource_uri,
      expires_at: expiresAt,
    }]);
    if (codeError) {
      await adminClient().database.from("mcp_oauth_grants").update({ revoked_at: nowIso() }).eq("id", grantId);
      throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudo completar la autorización.");
    }

    operation = "consent_approved";
    await recordAudit(grantId, operation, "success");
    return jsonResponse({
      redirect_url: redirectWithOAuthResult(authorizationRequest.redirect_uri, {
        code,
        state: authorizationRequest.state,
        iss: config.issuer,
      }),
    });
  } catch (error) {
    if (error instanceof McpOAuthError) {
      await recordAudit(grantId, operation, "denied");
      return oauthError(new OAuthHttpError(400, error.code, error.message));
    }
    if (error instanceof OAuthHttpError) {
      await recordAudit(grantId, operation, "denied");
      return oauthError(error);
    }
    await recordAudit(grantId, operation, "error");
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudo completar la autorización."));
  }
}

async function loadGrant(grantId: string): Promise<GrantRow> {
  const { data, error } = await adminClient().database.from("mcp_oauth_grants")
    .select("id, owner_id, client_id, scopes, insforge_access_token_ciphertext, insforge_access_token_iv, insforge_access_expires_at, revoked_at")
    .eq("id", grantId)
    .maybeSingle();
  if (error || !data) {
    throw new OAuthHttpError(400, "invalid_grant", "La autorización MCP ya no está disponible.");
  }
  const grant = data as GrantRow;
  if (grant.revoked_at) {
    throw new OAuthHttpError(400, "invalid_grant", "La autorización MCP fue revocada.");
  }
  return grant;
}

async function issueTokenPair(
  grant: GrantRow,
  config: McpOAuthConfig,
  familyId: string = crypto.randomUUID(),
): Promise<Record<string, unknown>> {
  if (Date.parse(grant.insforge_access_expires_at) <= Date.now()) {
    throw new OAuthHttpError(400, "invalid_grant", "Tu sesión de Karenda venció. Autoriza la conexión nuevamente.");
  }

  const accessToken = createOpaqueToken(32);
  const refreshToken = createOpaqueToken(32);
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();
  const [accessHash, refreshHash] = await Promise.all([
    hashOpaqueToken(accessToken),
    hashOpaqueToken(refreshToken),
  ]);

  const { error: accessError } = await adminClient().database.from("mcp_access_tokens").insert([{
    token_hash: accessHash,
    grant_id: grant.id,
    resource_uri: config.resource,
    expires_at: accessExpiresAt,
  }]);
  if (accessError) {
    throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudieron emitir los tokens MCP.");
  }
  const { error: refreshError } = await adminClient().database.from("mcp_refresh_tokens").insert([{
    token_hash: refreshHash,
    grant_id: grant.id,
    family_id: familyId,
    expires_at: refreshExpiresAt,
  }]);
  if (refreshError) {
    await Promise.all([
      adminClient().database.from("mcp_access_tokens").delete().eq("token_hash", accessHash),
      adminClient().database.from("mcp_refresh_tokens").delete().eq("token_hash", refreshHash),
    ]);
    throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudieron emitir los tokens MCP.");
  }

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scopes.join(" "),
  };
}

async function exchangeAuthorizationCode(
  request: Request,
  form: URLSearchParams,
  config: McpOAuthConfig,
): Promise<Response> {
  const code = form.get("code") ?? "";
  const clientId = form.get("client_id") ?? "";
  const redirectUri = form.get("redirect_uri") ?? "";
  const verifier = form.get("code_verifier") ?? "";
  const resource = form.get("resource") ?? "";
  if (!code || !clientId || !redirectUri || !verifier || resource !== config.resource) {
    throw new OAuthHttpError(400, "invalid_grant", "El código de autorización no es válido.");
  }

  await lookupClientByRedirect(clientId, redirectUri);
  const codeHash = await hashOpaqueToken(code);
  const { data, error } = await adminClient().database.from("mcp_authorization_codes")
    .select("code_hash, grant_id, client_id, redirect_uri, code_challenge, resource_uri, expires_at, used_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error || !data) {
    throw new OAuthHttpError(400, "invalid_grant", "El código de autorización venció o ya fue utilizado.");
  }

  const authorizationCode = data as {
    grant_id: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    resource_uri: string;
    expires_at: string;
    used_at: string | null;
  };
  if (
    authorizationCode.used_at ||
    Date.parse(authorizationCode.expires_at) <= Date.now() ||
    authorizationCode.client_id !== clientId ||
    authorizationCode.redirect_uri !== redirectUri ||
    authorizationCode.resource_uri !== resource
  ) {
    throw new OAuthHttpError(400, "invalid_grant", "El código de autorización venció o ya fue utilizado.");
  }
  if (!await verifyPkceS256(verifier, authorizationCode.code_challenge)) {
    throw new OAuthHttpError(400, "invalid_grant", "La comprobación PKCE del cliente no coincide.");
  }

  const { data: consumed, error: consumeError } = await adminClient().database
    .from("mcp_authorization_codes")
    .update({ used_at: nowIso() })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", nowIso())
    .select("grant_id")
    .maybeSingle();
  if (consumeError || !consumed) {
    throw new OAuthHttpError(400, "invalid_grant", "El código de autorización ya fue utilizado.");
  }

  const grant = await loadGrant(authorizationCode.grant_id);
  await recordAudit(grant.id, "token_issued", "success");
  return jsonResponse(await issueTokenPair(grant, config));
}

async function revokeRefreshFamily(familyId: string, grantId: string): Promise<void> {
  const now = nowIso();
  await adminClient().database.from("mcp_refresh_tokens")
    .update({ revoked_at: now })
    .eq("family_id", familyId)
    .is("revoked_at", null);
  await adminClient().database.from("mcp_access_tokens")
    .update({ revoked_at: now })
    .eq("grant_id", grantId)
    .is("revoked_at", null);
  await adminClient().database.from("mcp_oauth_grants")
    .update({ revoked_at: now })
    .eq("id", grantId)
    .is("revoked_at", null);
}

async function rotateRefreshToken(
  form: URLSearchParams,
  config: McpOAuthConfig,
): Promise<Response> {
  const refreshToken = form.get("refresh_token") ?? "";
  const clientId = form.get("client_id") ?? "";
  const resource = form.get("resource") ?? "";
  if (!refreshToken || !clientId || resource !== config.resource) {
    throw new OAuthHttpError(400, "invalid_grant", "El token de renovación no es válido.");
  }

  const tokenHash = await hashOpaqueToken(refreshToken);
  const { data, error } = await adminClient().database.from("mcp_refresh_tokens")
    .select("token_hash, grant_id, family_id, expires_at, used_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) {
    throw new OAuthHttpError(400, "invalid_grant", "El token de renovación venció o ya fue utilizado.");
  }

  const refresh = data as RefreshTokenRow;
  const grant = await loadGrant(refresh.grant_id);
  if (grant.client_id !== clientId) {
    throw new OAuthHttpError(400, "invalid_grant", "El token de renovación pertenece a otro cliente.");
  }
  if (refresh.used_at) {
    await revokeRefreshFamily(refresh.family_id, refresh.grant_id);
    await recordAudit(refresh.grant_id, "refresh_reuse_detected", "denied");
    throw new OAuthHttpError(400, "invalid_grant", "Se detectó la reutilización del token. Autoriza la conexión nuevamente.");
  }
  if (refresh.revoked_at || Date.parse(refresh.expires_at) <= Date.now()) {
    throw new OAuthHttpError(400, "invalid_grant", "El token de renovación venció o fue revocado.");
  }

  const { data: consumed, error: consumeError } = await adminClient().database
    .from("mcp_refresh_tokens")
    .update({ used_at: nowIso() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso())
    .select("family_id")
    .maybeSingle();
  if (consumeError || !consumed) {
    await revokeRefreshFamily(refresh.family_id, refresh.grant_id);
    throw new OAuthHttpError(400, "invalid_grant", "El token de renovación ya fue utilizado.");
  }

  const grantWithToken = await loadGrant(refresh.grant_id);
  const response = await issueTokenPair(grantWithToken, config, refresh.family_id);
  await recordAudit(grant.id, "token_refreshed", "success");
  return jsonResponse(response);
}

export async function tokenEndpoint(
  request: Request,
  config: McpOAuthConfig,
): Promise<Response> {
  try {
    const form = await readOAuthForm(request);
    const grantType = form.get("grant_type");
    if (grantType === "authorization_code") {
      return await exchangeAuthorizationCode(request, form, config);
    }
    if (grantType === "refresh_token") {
      return await rotateRefreshToken(form, config);
    }
    throw new OAuthHttpError(400, "unsupported_grant_type", "Karenda no admite este tipo de autorización.");
  } catch (error) {
    if (error instanceof OAuthHttpError) return oauthError(error);
    if (error instanceof McpOAuthError) return oauthError(new OAuthHttpError(400, error.code, error.message));
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudo completar la autorización MCP."));
  }
}

export async function revokeToken(request: Request): Promise<Response> {
  try {
    const form = await readOAuthForm(request);
    const token = form.get("token") ?? "";
    if (!token) return jsonResponse({}, 200);
    const hash = await hashOpaqueToken(token);
    const now = nowIso();
    const admin = adminClient();

    const { data: refresh } = await admin.database.from("mcp_refresh_tokens")
      .select("grant_id, family_id")
      .eq("token_hash", hash)
      .maybeSingle();
    if (refresh) {
      await revokeRefreshFamily(refresh.family_id as string, refresh.grant_id as string);
      return jsonResponse({}, 200);
    }

    await admin.database.from("mcp_access_tokens")
      .update({ revoked_at: now })
      .eq("token_hash", hash)
      .is("revoked_at", null);
    return jsonResponse({}, 200);
  } catch {
    return jsonResponse({}, 200);
  }
}

export async function listOAuthGrants(request: Request, config: McpOAuthConfig): Promise<Response> {
  try {
    const session = await authenticateWebSession(request, config.baseUrl);
    const { data, error } = await adminClient().database.from("mcp_oauth_grants")
      .select("id, client_id, scopes, granted_at, last_used_at, revoked_at")
      .eq("owner_id", session.userId)
      .order("granted_at", { ascending: false })
      .limit(500);
    if (error) throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudieron cargar las conexiones MCP.");

    const grants = (data ?? []) as Array<{
      id: string;
      client_id: string;
      scopes: string[];
      granted_at: string;
      last_used_at: string | null;
      revoked_at: string | null;
    }>;
    const clientIds = [...new Set(grants.map((grant) => grant.client_id))];
    const clientNames = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients, error: clientsError } = await adminClient().database.from("mcp_oauth_clients")
        .select("client_id, client_name")
        .in("client_id", clientIds);
      if (clientsError) throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudieron cargar las conexiones MCP.");
      for (const client of clients ?? []) clientNames.set(client.client_id as string, client.client_name as string);
    }

    return jsonResponse({
      grants: grants.map((grant) => ({
        id: grant.id,
        clientName: clientNames.get(grant.client_id) ?? "Cliente MCP",
        scopes: grant.scopes,
        grantedAt: grant.granted_at,
        lastUsedAt: grant.last_used_at,
        revokedAt: grant.revoked_at,
      })),
    });
  } catch (error) {
    if (error instanceof OAuthHttpError) return oauthError(error);
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudieron cargar las conexiones MCP."));
  }
}

async function revokeGrantIds(grantIds: string[], ownerId: string): Promise<number> {
  const admin = adminClient();
  const now = nowIso();
  let revokedCount = 0;
  for (let index = 0; index < grantIds.length; index += 100) {
    const ids = grantIds.slice(index, index + 100);
    const { data, error } = await admin.database.from("mcp_oauth_grants")
      .update({ revoked_at: now })
      .eq("owner_id", ownerId)
      .in("id", ids)
      .is("revoked_at", null)
      .select("id");
    if (error) throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudo revocar la conexión MCP.");
    const changedIds = (data ?? []).map((grant) => grant.id as string);
    if (changedIds.length === 0) continue;
    revokedCount += changedIds.length;
    await admin.database.from("mcp_refresh_tokens").update({ revoked_at: now })
      .in("grant_id", changedIds).is("revoked_at", null);
    await admin.database.from("mcp_access_tokens").update({ revoked_at: now })
      .in("grant_id", changedIds).is("revoked_at", null);
    for (const grantId of changedIds) await recordAudit(grantId, "grant_revoked", "success");
  }
  return revokedCount;
}

export async function revokeUserOAuthGrants(request: Request, config: McpOAuthConfig): Promise<Response> {
  try {
    const session = await authenticateWebSession(request, config.baseUrl);
    const body = await readJsonBody(request);
    const revokeAll = body.revoke_all === true;
    const grantId = typeof body.grant_id === "string" ? body.grant_id : "";
    if (!revokeAll && !/^[0-9a-f-]{36}$/i.test(grantId)) {
      throw new OAuthHttpError(400, "invalid_request", "Selecciona una conexión MCP válida.");
    }

    const admin = adminClient();
    const query = admin.database.from("mcp_oauth_grants").select("id")
      .eq("owner_id", session.userId).is("revoked_at", null);
    const { data, error } = await (revokeAll ? query : query.eq("id", grantId));
    if (error) throw new OAuthHttpError(503, "temporarily_unavailable", "No se pudieron localizar las conexiones MCP.");
    const grantIds = (data ?? []).map((grant) => grant.id as string);
    const revokedCount = await revokeGrantIds(grantIds, session.userId);
    return jsonResponse({ revoked_count: revokedCount });
  } catch (error) {
    if (error instanceof OAuthHttpError) return oauthError(error);
    return oauthError(new OAuthHttpError(503, "temporarily_unavailable", "No se pudo revocar la conexión MCP."));
  }
}

export async function authenticateMcpRequest(
  request: Request,
  config: McpOAuthConfig,
): Promise<{ principal: McpPrincipal; userClient: ReturnType<typeof createClient> } | Response> {
  const accessToken = bearerToken(request);
  if (!accessToken) return unauthorizedResourceResponse(config);

  try {
    const tokenHash = await hashOpaqueToken(accessToken);
    const { data, error } = await adminClient().database.from("mcp_access_tokens")
      .select("token_hash, grant_id, resource_uri, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error || !data) return unauthorizedResourceResponse(config);

    const token = data as AccessTokenRow;
    if (
      token.revoked_at ||
      Date.parse(token.expires_at) <= Date.now() ||
      token.resource_uri !== config.resource
    ) {
      return unauthorizedResourceResponse(config);
    }

    const grant = await loadGrant(token.grant_id);
    if (Date.parse(grant.insforge_access_expires_at) <= Date.now()) {
      return unauthorizedResourceResponse(config);
    }

    const insforgeAccessToken = await decryptSecret({
      ciphertext: grant.insforge_access_token_ciphertext,
      iv: grant.insforge_access_token_iv,
    }, config.encryptionKey);
    const userClient = createClient({ baseUrl: config.baseUrl, accessToken: insforgeAccessToken });
    const { data: currentUser, error: userError } = await userClient.auth.getCurrentUser();
    if (userError || currentUser?.user?.id !== grant.owner_id) {
      return unauthorizedResourceResponse(config);
    }

    await adminClient().database.from("mcp_oauth_grants")
      .update({ last_used_at: nowIso() })
      .eq("id", grant.id);

    return {
      principal: {
        ownerId: grant.owner_id,
        scopes: grant.scopes,
        accessToken: insforgeAccessToken,
        clientId: grant.client_id,
        grantId: grant.id,
      },
      userClient,
    };
  } catch {
    return unauthorizedResourceResponse(config);
  }
}

export function createOAuthConfig(baseUrl: string): McpOAuthConfig {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new OAuthHttpError(503, "temporarily_unavailable", "La conexión con InsForge no está configurada.");
  }
  const appKey = parsed.hostname.split(".")[0];
  if (!appKey || !parsed.protocol.startsWith("https")) {
    throw new OAuthHttpError(503, "temporarily_unavailable", "La conexión con InsForge no está configurada.");
  }

  const functionOrigin = `https://${appKey}.function2.insforge.app`;
  const issuer = `${functionOrigin}/karenda-mcp`;
  const webOrigin = (Deno.env.get("KARENDA_WEB_ORIGIN") ?? "https://5zz5dxgt.insforge.site").replace(/\/$/, "");
  const consentUrl = Deno.env.get("MCP_CONSENT_URL") ?? `${webOrigin}/mcp/consent`;
  const encryptionKey = Deno.env.get("MCP_INSFORGE_ACCESS_TOKEN_ENCRYPTION_KEY") ?? "";

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    functionOrigin,
    issuer,
    resource: `${issuer}/mcp`,
    protectedResourceMetadataUrl: `${issuer}/.well-known/oauth-protected-resource/mcp`,
    authorizationMetadataUrl: `${issuer}/.well-known/openid-configuration`,
    consentUrl,
    webOrigin,
    encryptionKey,
  };
}

export function getAllowedOrigins(config: McpOAuthConfig): Set<string> {
  return new Set([
    config.functionOrigin,
    config.webOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
}

export function originHeaders(request: Request, config: McpOAuthConfig): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type, Last-Event-ID, MCP-Protocol-Version, MCP-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && originAllowed(request, config)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  return headers;
}

export function originAllowed(request: Request, config: McpOAuthConfig): boolean {
  const origin = request.headers.get("Origin");
  if (!origin || getAllowedOrigins(config).has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]") &&
      parsed.origin === origin;
  } catch {
    return false;
  }
}

export async function oauthRoute(
  request: Request,
  path: string,
  config: McpOAuthConfig,
): Promise<Response | null> {
  try {
    if (!originAllowed(request, config)) {
      return jsonResponse({ error: "forbidden", message: "El origen de la solicitud no está permitido." }, 403);
    }

    const isRateLimitedRoute = path.startsWith("/oauth/");
    if (isRateLimitedRoute && request.method !== "OPTIONS") {
      const protections = createPersistentMcpProtectionStore(config.baseUrl, config.encryptionKey);
      const address = forwardedClientAddress(request) ?? "unknown-client";
      const isRegistration = path === "/oauth/register";
      const allowed = await protections.consumeRateLimit(
        `ip:${address}:oauth:${path}`,
        60,
        isRegistration ? 20 : 60,
      );
      if (!allowed) {
        return jsonResponse({
          error: "rate_limited",
          error_description: "Karenda recibió demasiadas solicitudes de autorización. Espera un minuto y vuelve a intentar.",
        }, 429, { "Retry-After": "60" });
      }
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: originHeaders(request, config) });
    }

    if (request.method === "GET" && path === "/.well-known/oauth-protected-resource/mcp") {
      return jsonResponse(buildProtectedResourceMetadata(config));
    }
    if (
      request.method === "GET" &&
      (path === "/.well-known/openid-configuration" ||
        path === "/.well-known/oauth-authorization-server")
    ) {
      return jsonResponse(buildOAuthMetadata(config));
    }
    if (request.method === "POST" && path === "/oauth/register") {
      return registerOAuthClient(request);
    }
    if (request.method === "GET" && path === "/oauth/authorize") {
      return beginAuthorization(request, config);
    }
    if (request.method === "GET" && path === "/oauth/consent") {
      return getConsentRequest(request, config);
    }
    if (request.method === "POST" && path === "/oauth/consent") {
      return decideConsent(request, config);
    }
    if (request.method === "POST" && path === "/oauth/token") {
      return tokenEndpoint(request, config);
    }
    if (request.method === "POST" && path === "/oauth/revoke") {
      return revokeToken(request);
    }
    if (request.method === "GET" && path === "/oauth/grants") {
      return listOAuthGrants(request, config);
    }
    if (request.method === "POST" && path === "/oauth/grants/revoke") {
      return revokeUserOAuthGrants(request, config);
    }
    if (path.startsWith("/oauth/")) {
      return jsonResponse({ error: "not_found", message: "La ruta OAuth solicitada no existe." }, 404);
    }
    return null;
  } catch {
    return jsonResponse({ error: "temporarily_unavailable", message: "El servicio MCP no está disponible." }, 503);
  }
}
