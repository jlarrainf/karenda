const ALLOWED_SCOPES = new Set([
  "profile:read",
  "events:read",
  "events:write",
  "events:delete",
  "notes:read",
  "notes:write",
  "notes:delete",
  "habits:read",
  "habits:write",
  "habits:delete",
  "recurring:read",
  "recurring:write",
  "catalogs:read",
  "catalogs:write",
  "catalogs:delete",
  "canvas:read",
  "canvas:sync",
  "canvas:review",
  "ai:draft",
]);

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const FORBIDDEN_REDIRECT_PROTOCOLS = new Set([
  "data:",
  "file:",
  "ftp:",
  "javascript:",
]);

function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);
    if (characterCode <= 0x1f || characterCode === 0x7f) return true;
  }
  return false;
}

export class McpOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/g,
    "",
  );
}

function decodeBase64Url(value: string): Uint8Array {
  if (!value || !BASE64_URL_PATTERN.test(value)) {
    throw new McpOAuthError(
      "invalid_request",
      "El formato de seguridad no es válido.",
    );
  }

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function parseRequestedScopes(value: string): string[] {
  if (value.length > 1024) {
    throw new McpOAuthError(
      "invalid_scope",
      "La lista de permisos es demasiado larga.",
    );
  }

  const scopes = [...new Set(value.trim().split(/\s+/).filter(Boolean))].sort();
  const unknownScope = scopes.find((scope) => !ALLOWED_SCOPES.has(scope));

  if (unknownScope) {
    throw new McpOAuthError(
      "invalid_scope",
      "La solicitud incluye un permiso que Karenda no ofrece.",
    );
  }

  return scopes;
}

export function intersectGrantedScopes(
  requestedScopes: readonly string[],
  approvedScopes: readonly string[],
): string[] {
  const requested = new Set(requestedScopes);
  const unknownScope = approvedScopes.find(
    (scope) => !ALLOWED_SCOPES.has(scope) || !requested.has(scope),
  );

  if (unknownScope) {
    throw new McpOAuthError(
      "invalid_scope",
      "Solo se pueden conceder permisos incluidos en la solicitud.",
    );
  }

  return [...new Set(approvedScopes)].sort();
}

export function isAllowedRedirectUri(value: string): boolean {
  if (!value || value.length > 2048 || containsControlCharacters(value)) {
    return false;
  }

  let redirect: URL;
  try {
    redirect = new URL(value);
  } catch {
    return false;
  }

  if (
    redirect.username ||
    redirect.password ||
    redirect.hash ||
    FORBIDDEN_REDIRECT_PROTOCOLS.has(redirect.protocol)
  ) {
    return false;
  }

  if (redirect.protocol === "https:") {
    return Boolean(redirect.hostname);
  }

  if (redirect.protocol === "http:") {
    return LOOPBACK_HOSTS.has(redirect.hostname);
  }

  return /^[a-z][a-z0-9+.-]*:$/.test(redirect.protocol) &&
    !redirect.search && Boolean(redirect.pathname || redirect.hostname);
}

export function matchesRegisteredRedirectUri(
  requested: string,
  registered: readonly string[],
): boolean {
  if (!isAllowedRedirectUri(requested)) return false;

  return registered.some((candidate) => {
    if (!isAllowedRedirectUri(candidate)) return false;
    if (candidate === requested) return true;

    let requestedUrl: URL;
    let candidateUrl: URL;
    try {
      requestedUrl = new URL(requested);
      candidateUrl = new URL(candidate);
    } catch {
      return false;
    }

    const isLoopback = (url: URL) =>
      url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);

    return isLoopback(requestedUrl) &&
      isLoopback(candidateUrl) &&
      requestedUrl.protocol === candidateUrl.protocol &&
      requestedUrl.hostname === candidateUrl.hostname &&
      requestedUrl.pathname === candidateUrl.pathname &&
      requestedUrl.search === candidateUrl.search;
  });
}

export function assertResourceAudience(
  requestedResource: string,
  expectedResource: string,
): void {
  let parsedResource: URL;
  let parsedExpected: URL;

  try {
    parsedResource = new URL(requestedResource);
    parsedExpected = new URL(expectedResource);
  } catch {
    throw new McpOAuthError(
      "invalid_target",
      "El recurso solicitado no es válido.",
    );
  }

  const isAllowedScheme = (url: URL) =>
    url.protocol === "https:" ||
    (url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]"));

  if (
    !isAllowedScheme(parsedResource) ||
    !isAllowedScheme(parsedExpected) ||
    parsedResource.username ||
    parsedResource.password ||
    parsedResource.search ||
    parsedResource.hash ||
    requestedResource !== expectedResource
  ) {
    throw new McpOAuthError(
      "invalid_target",
      "El token solo se puede emitir para el recurso MCP de Karenda.",
    );
  }
}

export async function verifyPkceS256(
  codeVerifier: string,
  expectedChallenge: string,
): Promise<boolean> {
  if (
    !PKCE_VERIFIER_PATTERN.test(codeVerifier) ||
    !/^[A-Za-z0-9_-]{43}$/.test(expectedChallenge)
  ) {
    return false;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(toBytes(codeVerifier)),
  );
  const actualChallenge = encodeBase64Url(new Uint8Array(digest));
  const actualBytes = toBytes(actualChallenge);
  const expectedBytes = toBytes(expectedChallenge);

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }

  return difference === 0;
}

export function createOpaqueToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 32 || byteLength > 64) {
    throw new McpOAuthError(
      "invalid_request",
      "La longitud del token no es válida.",
    );
  }

  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return encodeBase64Url(bytes);
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(toBytes(token)),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

async function importEncryptionKey(encodedKey: string): Promise<CryptoKey> {
  let rawKey: Uint8Array;

  try {
    rawKey = decodeBase64Url(encodedKey);
  } catch {
    throw new McpOAuthError("server_error", "No se pudo proteger la conexión.");
  }

  if (rawKey.length !== 32) {
    throw new McpOAuthError(
      "server_error",
      "La clave de protección no tiene el tamaño esperado.",
    );
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(
  plaintext: string,
  encodedKey: string,
): Promise<EncryptedSecret> {
  const key = await importEncryptionKey(encodedKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(toBytes(plaintext)),
  );

  return {
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
    iv: encodeBase64Url(iv),
  };
}

export async function decryptSecret(
  encrypted: EncryptedSecret,
  encodedKey: string,
): Promise<string> {
  const key = await importEncryptionKey(encodedKey);

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(decodeBase64Url(encrypted.iv)),
      },
      key,
      toArrayBuffer(decodeBase64Url(encrypted.ciphertext)),
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    throw new McpOAuthError(
      "server_error",
      "No se pudo recuperar la conexión autorizada.",
    );
  }
}
