import { createMcpHandler } from "npm:@modelcontextprotocol/server@2.0.0";
import { createKarendaMcpServer } from "./server.ts";
import { addToolSecuritySchemes, toolScopes } from "../karenda-mcp.ts";
import type { KarendaClient } from "./domain.ts";
import type { McpPrincipal } from "./oauth.ts";

const principal: McpPrincipal = {
  ownerId: "00000000-0000-4000-8000-000000000001",
  scopes: [],
  accessToken: "test-token",
  clientId: "test-client",
  grantId: "00000000-0000-4000-8000-000000000002",
};

function request(id: number, method: string, params?: Record<string, unknown>): Request {
  return new Request("https://mcp.karenda.test/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
}

Deno.test("every registered tool advertises its OAuth scope", async () => {
  const handler = createMcpHandler(
    () => createKarendaMcpServer({} as KarendaClient, principal),
    { legacy: "stateless", responseMode: "auto" },
  );
  const listRequest = request(1, "tools/list");
  const original = await handler.fetch(listRequest);
  const secured = await addToolSecuritySchemes(listRequest, original);
  const body = await secured.text();
  const dataLine = body.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) throw new Error("The MCP tools/list response did not contain an SSE message.");
  const payload = JSON.parse(dataLine.slice(5).trim()) as { result?: { tools?: Array<{ name: string; securitySchemes?: Array<{ type: string; scopes: string[] }> }> } };
  const tools = payload.result?.tools ?? [];

  if (tools.length < 40) throw new Error("Expected the complete Karenda tool set, got " + tools.length + ".");
  for (const tool of tools) {
    const expectedScope = toolScopes[tool.name];
    if (!expectedScope) throw new Error("Tool " + tool.name + " has no registered scope.");
    if (tool.securitySchemes?.[0]?.type !== "oauth2" || tool.securitySchemes[0].scopes[0] !== expectedScope) {
      throw new Error("Tool " + tool.name + " does not advertise " + expectedScope + ".");
    }
  }
});

Deno.test("tool calls reject operations without the matching consent scope", async () => {
  const handler = createMcpHandler(
    () => createKarendaMcpServer({} as KarendaClient, principal),
    { legacy: "stateless", responseMode: "auto" },
  );
  const response = await handler.fetch(request(2, "tools/call", {
    name: "profile.get_context",
    arguments: { timeZone: "America/Santiago" },
  }));
  const body = await response.text();
  if (!body.includes("permiso") || !body.includes("profile:read")) {
    throw new Error("The server did not reject the call for insufficient scope.");
  }
});
