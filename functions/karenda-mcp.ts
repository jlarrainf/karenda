import { createMcpHandler } from "npm:@modelcontextprotocol/server@2.0.0";
import { createOAuthConfig, authenticateMcpRequest, oauthRoute, originAllowed, originHeaders } from "./mcp/oauth.ts";
import { createKarendaMcpServer } from "./mcp/server.ts";

const MAX_MCP_BODY_BYTES = 1024 * 1024;

function corsResponse(request: Request, response: Response, config: ReturnType<typeof createOAuthConfig>): Response {
  const headers = new Headers(response.headers);
  const cors = originHeaders(request, config);
  for (const [name, value] of cors) {
    if (name.toLowerCase() === "access-control-allow-origin" ||
      name.toLowerCase() === "access-control-allow-credentials" ||
      name.toLowerCase() === "access-control-allow-headers" ||
      name.toLowerCase() === "access-control-allow-methods" ||
      name.toLowerCase() === "access-control-max-age" ||
      name.toLowerCase() === "vary") {
      headers.set(name, value);
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function requestIsTooLarge(request: Request): Promise<boolean> {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_BODY_BYTES) return true;
  if (request.bodyUsed || !request.body) return false;
  const reader = request.clone().body?.getReader();
  if (!reader) return false;
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MCP_BODY_BYTES) {
        await reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: "request_rejected", message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const toolScopes: Record<string, string> = {
  "profile.get_context": "profile:read",
  "events.list": "events:read",
  "events.get": "events:read",
  "events.create": "events:write",
  "events.update": "events:write",
  "events.set_status": "events:write",
  "events.delete": "events:delete",
  "events.prepare_ai_draft": "ai:draft",
  "events.save_ai_draft": "events:write",
  "subjects.list": "catalogs:read",
  "subjects.get": "catalogs:read",
  "subjects.create": "catalogs:write",
  "subjects.update": "catalogs:write",
  "subjects.delete": "catalogs:delete",
  "personal_groups.list": "catalogs:read",
  "personal_groups.get": "catalogs:read",
  "personal_groups.create": "catalogs:write",
  "personal_groups.update": "catalogs:write",
  "personal_groups.delete": "catalogs:delete",
  "notes.list": "notes:read",
  "notes.get": "notes:read",
  "notes.create": "notes:write",
  "notes.update": "notes:write",
  "notes.delete": "notes:delete",
  "habits.prepare_ai_draft": "ai:draft",
  "habits.save_ai_draft": "habits:write",
  "habits.list": "habits:read",
  "habits.get": "habits:read",
  "habits.create": "habits:write",
  "habits.update": "habits:write",
  "habits.set_lifecycle": "habits:write",
  "habits.list_logs": "habits:read",
  "habits.mark_log": "habits:write",
  "habits.clear_log": "habits:delete",
  "habits.list_notes": "habits:read",
  "habits.create_note": "habits:write",
  "habits.update_note": "habits:write",
  "habits.delete_note": "habits:delete",
  "recurring.list": "recurring:read",
  "recurring.get": "recurring:read",
  "recurring.list_occurrences": "recurring:read",
  "recurring.list_schedule_versions": "recurring:read",
  "recurring.create": "recurring:write",
  "recurring.update": "recurring:write",
  "recurring.set_lifecycle": "recurring:write",
  "recurring.update_schedule": "recurring:write",
  "recurring.complete_occurrence": "recurring:write",
  "recurring.reschedule_occurrence": "recurring:write",
  "canvas.get_status": "canvas:read",
  "canvas.list_course_links": "canvas:read",
  "canvas.list_sync_runs": "canvas:read",
  "canvas.list_reviews": "canvas:read",
  "canvas.sync": "canvas:sync",
  "canvas.unlink_course": "canvas:review",
  "canvas.apply_review": "canvas:review",
};

export async function addToolSecuritySchemes(request: Request, response: Response): Promise<Response> {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (request.method !== "POST" || (!contentType.includes("application/json") && !contentType.includes("text/event-stream"))) return response;

  function decoratePayload(payload: unknown): unknown {
    if (typeof payload !== "object" || payload === null) return response;
    const result = (payload as Record<string, unknown>).result;
    if (typeof result !== "object" || result === null || !Array.isArray((result as Record<string, unknown>).tools)) return response;
    const tools = (result as { tools: unknown[] }).tools.map((tool) => {
      if (typeof tool !== "object" || tool === null || typeof (tool as Record<string, unknown>).name !== "string") return tool;
      const scope = toolScopes[(tool as { name: string }).name];
      return scope ? { ...(tool as Record<string, unknown>), securitySchemes: [{ type: "oauth2", scopes: [scope] }] } : tool;
    });
    return { ...(payload as Record<string, unknown>), result: { ...(result as Record<string, unknown>), tools } };
  }

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  if (contentType.includes("application/json")) {
    try {
      const payload = decoratePayload(await response.clone().json());
      if (payload === response) return response;
      return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
    } catch {
      return response;
    }
  }

  if (!response.body) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            pending += decoder.decode();
            if (pending) controller.enqueue(encoder.encode(rewriteSseLine(pending)));
            controller.close();
            return;
          }
          pending += decoder.decode(value, { stream: true });
          const newline = pending.lastIndexOf("\n");
          if (newline < 0) continue;
          const complete = pending.slice(0, newline + 1);
          pending = pending.slice(newline + 1);
          const lines = complete.split("\n");
          lines.pop();
          controller.enqueue(encoder.encode(lines.map(rewriteSseLine).join("\n") + "\n"));
          return;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
  return new Response(stream, { status: response.status, statusText: response.statusText, headers });

  function rewriteSseLine(line: string): string {
    const suffix = line.endsWith("\r") ? "\r" : "";
    const content = suffix ? line.slice(0, -1) : line;
    if (!content.startsWith("data:")) return line;
    const separator = content.slice(5).match(/^\s*/)?.[0] ?? "";
    try {
      const payload = JSON.parse(content.slice(5 + separator.length));
      const decorated = decoratePayload(payload);
      return decorated === response ? line : "data:" + separator + JSON.stringify(decorated) + suffix;
    } catch {
      return line;
    }
  }
}

export default async function handle(request: Request): Promise<Response> {
  let config: ReturnType<typeof createOAuthConfig>;
  try {
    const baseUrl = Deno.env.get("INSFORGE_BASE_URL") ?? "";
    config = createOAuthConfig(baseUrl);
  } catch {
    return errorResponse(503, "El servicio de Karenda MCP no está configurado.");
  }

  const path = new URL(request.url).pathname;
  const oauth = await oauthRoute(request, path, config);
  if (oauth) return corsResponse(request, oauth, config);

  if (!path.endsWith("/mcp") && path !== "/mcp") {
    return errorResponse(404, "La ruta solicitada no existe.");
  }
  if (!new Set(["POST", "GET", "DELETE", "OPTIONS"]).has(request.method)) {
    return new Response(null, {
      status: 405,
      headers: { Allow: "POST, GET, DELETE, OPTIONS", "Cache-Control": "no-store" },
    });
  }
  if (request.method === "OPTIONS") {
    return corsResponse(request, new Response(null, { status: 204 }), config);
  }
  if (!originAllowed(request, config)) {
    return errorResponse(403, "El origen de la solicitud no está permitido.");
  }
  if (await requestIsTooLarge(request)) {
    return errorResponse(413, "La solicitud supera el tamaño permitido.");
  }
  if (request.method === "POST" && !request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return errorResponse(415, "El endpoint MCP requiere application/json.");
  }

  const authenticated = await authenticateMcpRequest(request, config);
  if (authenticated instanceof Response) return corsResponse(request, authenticated, config);

  const handler = createMcpHandler(
    () => createKarendaMcpServer(authenticated.userClient, authenticated.principal),
    { legacy: "stateless", responseMode: "auto", keepAliveMs: 15000 },
  );
  const authInfo = {
    token: request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "",
    clientId: authenticated.principal.clientId,
    scopes: authenticated.principal.scopes,
    expiresAt: Math.floor(Date.now() / 1000) + 15 * 60,
    resource: new URL(config.resource),
    extra: { ownerId: authenticated.principal.ownerId, grantId: authenticated.principal.grantId },
  };
  try {
    const response = await handler.fetch(request, { authInfo });
    const decorated = await addToolSecuritySchemes(request, response);
    return corsResponse(request, decorated, config);
  } catch {
    return errorResponse(500, "No se pudo completar la solicitud MCP. Intenta nuevamente.");
  }
}
