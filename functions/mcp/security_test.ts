import {
  assertResourceAudience,
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

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

Deno.test("PKCE S256 accepts the RFC 7636 verifier pair", async () => {
  const valid = await verifyPkceS256(
    "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );

  if (!valid) throw new Error("Expected the known S256 pair to verify.");
});

Deno.test("PKCE S256 rejects malformed and mismatched verifiers", async () => {
  const malformed = await verifyPkceS256(
    "short",
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  const mismatched = await verifyPkceS256(
    "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );

  if (malformed || mismatched) throw new Error("Invalid PKCE data must fail.");
});

Deno.test("requested scopes are allowlisted, unique, and stable", () => {
  const scopes = parseRequestedScopes("events:write profile:read events:write");
  if (scopes.join(" ") !== "events:write profile:read") {
    throw new Error(`Unexpected scope normalization: ${scopes.join(" ")}`);
  }

  let threw = false;
  try {
    parseRequestedScopes("events:read admin:all");
  } catch (error) {
    threw = error instanceof McpOAuthError && error.code === "invalid_scope";
  }

  if (!threw) throw new Error("Unknown scopes must be rejected.");
});

Deno.test("approved scopes cannot exceed the original request", () => {
  const approved = intersectGrantedScopes(
    ["events:read", "events:write"],
    ["events:read"],
  );
  if (approved.join() !== "events:read") {
    throw new Error("The approved scope was not retained.");
  }

  let threw = false;
  try {
    intersectGrantedScopes(["events:read"], ["events:delete"]);
  } catch (error) {
    threw = error instanceof McpOAuthError && error.code === "invalid_scope";
  }

  if (!threw) throw new Error("A scope outside the request must be rejected.");
});

Deno.test("resource audience requires the canonical resource URL", () => {
  assertResourceAudience(
    "https://mcp.karenda.app/mcp",
    "https://mcp.karenda.app/mcp",
  );

  let threw = false;
  try {
    assertResourceAudience(
      "https://attacker.example/mcp",
      "https://mcp.karenda.app/mcp",
    );
  } catch (error) {
    threw = error instanceof McpOAuthError && error.code === "invalid_target";
  }

  if (!threw) throw new Error("A token for another resource must be rejected.");
});

Deno.test("OAuth redirects allow HTTPS and loopback only", () => {
  const allowed = [
    "https://client.example/callback",
    "http://127.0.0.1:43127/callback",
    "http://localhost:43127/callback",
    "http://[::1]:43127/callback",
    "claude://oauth/callback",
  ];
  const rejected = [
    "http://client.example/callback",
    "https://client.example/callback#fragment",
    "https://user:pass@client.example/callback",
    "javascript:alert(1)",
    "file:///tmp/callback",
  ];

  for (const value of allowed) {
    if (!isAllowedRedirectUri(value)) {
      throw new Error(`Expected redirect URI to be allowed: ${value}`);
    }
  }
  for (const value of rejected) {
    if (isAllowedRedirectUri(value)) {
      throw new Error(`Expected redirect URI to be rejected: ${value}`);
    }
  }
});

Deno.test("registered loopback redirects permit only dynamic port changes", () => {
  if (
    !matchesRegisteredRedirectUri(
      "http://127.0.0.1:51234/callback",
      ["http://127.0.0.1:43127/callback"],
    )
  ) {
    throw new Error("The loopback callback port should be allowed to change.");
  }

  if (
    matchesRegisteredRedirectUri(
      "http://127.0.0.1:51234/other",
      ["http://127.0.0.1:43127/callback"],
    )
  ) {
    throw new Error("The loopback callback path must match exactly.");
  }
});

Deno.test("opaque access tokens are random and stored as one-way hashes", async () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  if (first === second || first.length < 40) {
    throw new Error("Token entropy is insufficient.");
  }
  if ((await hashOpaqueToken(first)) === first) {
    throw new Error("The stored token must be hashed.");
  }
});

Deno.test("AES-GCM encryption protects and recovers a credential", async () => {
  const encrypted = await encryptSecret(
    "short-lived-access-token",
    encryptionKey,
  );
  if (encrypted.ciphertext.includes("short-lived-access-token")) {
    throw new Error("Ciphertext unexpectedly contains plaintext.");
  }
  if (
    (await decryptSecret(encrypted, encryptionKey)) !==
      "short-lived-access-token"
  ) {
    throw new Error("The encrypted credential did not round trip.");
  }

  let threw = false;
  try {
    await decryptSecret(
      encrypted,
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    );
  } catch (error) {
    threw = error instanceof McpOAuthError && error.code === "server_error";
  }

  if (!threw) {
    throw new Error("An invalid encryption key must not decrypt a credential.");
  }
});
