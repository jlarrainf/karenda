import { originAllowed, originHeaders, type McpOAuthConfig } from "./oauth.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: string | null, expected: string | null): void {
  if (actual !== expected) throw new Error("Expected " + expected + ", got " + actual + ".");
}

const config: McpOAuthConfig = {
  baseUrl: "https://karenda.insforge.app",
  functionOrigin: "https://karenda.function2.insforge.app",
  issuer: "https://karenda.function2.insforge.app/karenda-mcp",
  resource: "https://karenda.function2.insforge.app/karenda-mcp/mcp",
  protectedResourceMetadataUrl: "https://karenda.function2.insforge.app/karenda-mcp/.well-known/oauth-protected-resource/mcp",
  authorizationMetadataUrl: "https://karenda.function2.insforge.app/karenda-mcp/.well-known/openid-configuration",
  consentUrl: "https://karenda.insforge.site/mcp/consent",
  webOrigin: "https://karenda.insforge.site",
  encryptionKey: "unused-in-this-test",
};

Deno.test("OAuth CORS returns headers for registered and variable-port loopback origins", () => {
  const loopback = new Request("https://karenda.function2.insforge.app/karenda-mcp/mcp", {
    headers: { Origin: "http://127.0.0.1:56872" },
  });
  assert(originAllowed(loopback, config), "The dynamic loopback origin should be allowed.");
  assertEquals(originHeaders(loopback, config).get("Access-Control-Allow-Origin"), "http://127.0.0.1:56872");

  const registered = new Request("https://karenda.function2.insforge.app/karenda-mcp/mcp", {
    headers: { Origin: "https://karenda.insforge.site" },
  });
  assertEquals(originHeaders(registered, config).get("Access-Control-Allow-Origin"), "https://karenda.insforge.site");

  const untrusted = new Request("https://karenda.function2.insforge.app/karenda-mcp/mcp", {
    headers: { Origin: "https://attacker.example" },
  });
  assert(!originAllowed(untrusted, config), "An untrusted browser origin should be rejected.");
  assertEquals(originHeaders(untrusted, config).get("Access-Control-Allow-Origin"), null);
});
