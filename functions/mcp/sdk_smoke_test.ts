import {
  createMcpHandler,
  McpServer,
} from "npm:@modelcontextprotocol/server@2.0.0";
import * as z from "npm:zod@4.5.4";

Deno.test("the official MCP web-standard SDK runs on Deno", async () => {
  const handler = createMcpHandler(() => {
    const server = new McpServer({
      name: "karenda-mcp-smoke",
      version: "0.1.0",
    });
    server.registerTool(
      "mcp.smoke",
      {
        description: "Prueba local del transporte MCP.",
        inputSchema: z.object({ value: z.string().max(40) }),
      },
      async ({ value }) => ({
        content: [{ type: "text", text: `Recibido: ${value}` }],
      }),
    );
    return server;
  });

  const response = await handler.fetch(
    new Request("https://mcp.karenda.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    }),
  );
  const body = await response.text();

  if (!response.ok || !body.includes("mcp.smoke")) {
    throw new Error(
      `The MCP SDK did not return the registered tool (HTTP ${response.status}).`,
    );
  }
});
