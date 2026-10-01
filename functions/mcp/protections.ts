/* eslint-disable @typescript-eslint/no-explicit-any -- InsForge's dynamic database RPC surface is shared with Deno Edge Functions. */
import { createAdminClient } from "npm:@insforge/sdk@1.5.2";
import type { McpPrincipal } from "./oauth.ts";

export type McpToolOutcome =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

export type IdempotencyClaim =
  | { state: "claimed" }
  | { state: "in_progress" }
  | { state: "conflict" }
  | { state: "replay"; response: McpToolOutcome };

export interface McpProtectionStore {
  claimIdempotency(input: {
    keyHash: string;
    ownerId: string;
    grantId: string;
    toolName: string;
    requestHash: string;
  }): Promise<IdempotencyClaim>;
  completeIdempotency(keyHash: string, requestHash: string, response: McpToolOutcome): Promise<void>;
  consumeRateLimit(bucket: string, windowSeconds: number, limit: number): Promise<boolean>;
}

export class McpProtectionError extends Error {
  constructor(readonly code: "rate_limited" | "idempotency_conflict" | "idempotency_in_progress" | "unavailable", message: string) {
    super(message);
    this.name = "McpProtectionError";
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashMcpValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

export async function hashRateLimitBucket(secret: string, value: string): Promise<string> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("karenda-mcp-v1"),
      info: new TextEncoder().encode("rate-limit-bucket-hmac"),
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

export async function runIdempotently(
  store: McpProtectionStore,
  principal: Pick<McpPrincipal, "ownerId" | "grantId">,
  toolName: string,
  idempotencyKey: string,
  input: unknown,
  operation: () => Promise<McpToolOutcome>,
): Promise<McpToolOutcome> {
  const [keyHash, requestHash] = await Promise.all([
    hashMcpValue(`${principal.grantId}\n${toolName}\n${idempotencyKey}`),
    hashMcpValue(JSON.stringify(stableValue(input)) ?? "null"),
  ]);
  const claim = await store.claimIdempotency({
    keyHash,
    ownerId: principal.ownerId,
    grantId: principal.grantId,
    toolName,
    requestHash,
  });

  if (claim.state === "replay") return claim.response;
  if (claim.state === "conflict") {
    throw new McpProtectionError("idempotency_conflict", "La clave idempotente ya se usó con otra solicitud. Genera una clave nueva.");
  }
  if (claim.state === "in_progress") {
    throw new McpProtectionError("idempotency_in_progress", "La operación sigue procesándose. Consulta el estado en Karenda antes de volver a intentarla.");
  }

  const response = await operation();
  await store.completeIdempotency(keyHash, requestHash, response);
  return response;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length > 0 && typeof value[0] === "object" && value[0] !== null
    ? value[0] as Record<string, unknown>
    : null;
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

export function createPersistentMcpProtectionStore(baseUrl: string, hashingSecret: string): McpProtectionStore {
  const apiKey = Deno.env.get("API_KEY") ?? "";
  if (!apiKey || !baseUrl || !hashingSecret) {
    throw new McpProtectionError("unavailable", "Los controles seguros de Karenda MCP no están configurados.");
  }
  const admin = createAdminClient({ baseUrl, apiKey });

  return {
    async claimIdempotency(input) {
      const { data, error } = await (admin.database as any).rpc("mcp_claim_idempotency", {
        p_key_hash: input.keyHash,
        p_owner_id: input.ownerId,
        p_grant_id: input.grantId,
        p_tool_name: input.toolName,
        p_request_hash: input.requestHash,
      });
      if (error) throw new McpProtectionError("unavailable", "No se pudo proteger el reintento de esta operación.");
      const row = firstRow(data);
      const state = row?.claim_state;
      if (state === "claimed" || state === "in_progress" || state === "conflict") return { state };
      if (state === "replay" && typeof row?.cached_response === "object" && row.cached_response !== null) {
        return { state, response: row.cached_response as McpToolOutcome };
      }
      throw new McpProtectionError("unavailable", "No se pudo validar la clave de reintento.");
    },

    async completeIdempotency(keyHash, requestHash, response) {
      const { data, error } = await (admin.database as any).rpc("mcp_complete_idempotency", {
        p_key_hash: keyHash,
        p_request_hash: requestHash,
        p_response: response,
      });
      if (error || data !== true) {
        throw new McpProtectionError("unavailable", "Karenda guardó la operación, pero no pudo confirmar su resultado. Consulta el registro antes de reintentar.");
      }
    },

    async consumeRateLimit(bucket, windowSeconds, limit) {
      const key = await hashRateLimitBucket(hashingSecret, bucket);
      const { data, error } = await (admin.database as any).rpc("mcp_consume_rate_limit", {
        p_bucket_key: key,
        p_window_seconds: windowSeconds,
        p_limit: limit,
      });
      if (error) throw new McpProtectionError("unavailable", "No se pudo comprobar el límite de solicitudes.");
      const row = firstRow(data);
      if (typeof row?.allowed !== "boolean") {
        throw new McpProtectionError("unavailable", "No se pudo comprobar el límite de solicitudes.");
      }
      return row.allowed;
    },
  };
}

export async function enforceToolRateLimit(
  store: McpProtectionStore,
  principal: Pick<McpPrincipal, "grantId">,
  toolName: string,
  readOnly: boolean,
): Promise<void> {
  const allowed = await store.consumeRateLimit(
    `grant:${principal.grantId}:tool:${toolName}`,
    60,
    readOnly ? 120 : 30,
  );
  if (!allowed) {
    throw new McpProtectionError("rate_limited", "Karenda recibió demasiadas solicitudes para esta operación. Espera un minuto y vuelve a intentar.");
  }
}

export function forwardedClientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded || forwarded.length > 2048) return null;
  // InsForge function requests currently arrive through CloudFront, which appends the viewer address to this header.
  const candidate = forwarded.split(",").at(-1)?.trim() ?? "";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate)) {
    const octets = candidate.split(".").map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255) ? octets.join(".") : null;
  }
  const ipv6 = candidate.startsWith("[") && candidate.endsWith("]")
    ? candidate.slice(1, -1)
    : candidate;
  if (!ipv6.includes(":") || !/^[0-9a-fA-F:.]+$/.test(ipv6)) return null;
  try {
    return new URL(`http://[${ipv6}]/`).hostname.slice(1, -1).toLowerCase();
  } catch {
    return null;
  }
}
