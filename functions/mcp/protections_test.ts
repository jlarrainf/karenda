import {
  forwardedClientAddress,
  hashRateLimitBucket,
  hashMcpValue,
  McpProtectionError,
  runIdempotently,
  type IdempotencyClaim,
  type McpProtectionStore,
  type McpToolOutcome,
} from "./protections.ts";

function createMemoryStore(): McpProtectionStore {
  const receipts = new Map<string, { requestHash: string; response: McpToolOutcome | null }>();
  const counters = new Map<string, number>();
  return {
    async claimIdempotency(input): Promise<IdempotencyClaim> {
      const existing = receipts.get(input.keyHash);
      if (!existing) {
        receipts.set(input.keyHash, { requestHash: input.requestHash, response: null });
        return { state: "claimed" };
      }
      if (existing.requestHash !== input.requestHash) return { state: "conflict" };
      return existing.response ? { state: "replay", response: existing.response } : { state: "in_progress" };
    },
    async completeIdempotency(keyHash, requestHash, response) {
      const receipt = receipts.get(keyHash);
      if (!receipt || receipt.requestHash !== requestHash) throw new Error("Receipt not found.");
      receipt.response = response;
    },
    async consumeRateLimit(bucket) {
      const count = (counters.get(bucket) ?? 0) + 1;
      counters.set(bucket, count);
      return count <= 2;
    },
  };
}

const principal = { ownerId: "user-a", grantId: "grant-a" };

Deno.test("same idempotency key and input replays the persisted result without repeating a write", async () => {
  const store = createMemoryStore();
  let writes = 0;
  const execute = () => runIdempotently(store, principal, "events.create", "key-one", { title: "Control" }, async () => {
    writes += 1;
    return { ok: true, value: { id: "event-a" } };
  });

  const first = await execute();
  const replay = await execute();
  if (writes !== 1 || JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error("The retry repeated the write or changed the cached response.");
  }
});

Deno.test("same idempotency key with different input is rejected", async () => {
  const store = createMemoryStore();
  await runIdempotently(store, principal, "events.create", "key-one", { title: "Control" }, async () => ({ ok: true, value: {} }));
  try {
    await runIdempotently(store, principal, "events.create", "key-one", { title: "Examen" }, async () => ({ ok: true, value: {} }));
  } catch (error) {
    if (error instanceof McpProtectionError && error.code === "idempotency_conflict") return;
    throw error;
  }
  throw new Error("A key reused with different input was accepted.");
});

Deno.test("an in-progress idempotent operation cannot be executed a second time", async () => {
  const store = createMemoryStore();
  const keyHash = await hashMcpValue(`${principal.grantId}\nevents.create\nkey-one`);
  const requestHash = await hashMcpValue(JSON.stringify({ title: "Control" }));
  await store.claimIdempotency({ keyHash, requestHash, ownerId: principal.ownerId, grantId: principal.grantId, toolName: "events.create" });
  try {
    await runIdempotently(store, principal, "events.create", "key-one", { title: "Control" }, async () => ({ ok: true, value: {} }));
  } catch (error) {
    if (error instanceof McpProtectionError && error.code === "idempotency_in_progress") return;
    throw error;
  }
  throw new Error("A duplicate call ran while the original operation was in progress.");
});

Deno.test("rate limit buckets count requests independently", async () => {
  const store = createMemoryStore();
  if (!await store.consumeRateLimit("grant-a:events.list", 60, 2)) throw new Error("First request was rejected.");
  if (!await store.consumeRateLimit("grant-a:events.list", 60, 2)) throw new Error("Second request was rejected.");
  if (await store.consumeRateLimit("grant-a:events.list", 60, 2)) throw new Error("Request above the limit was accepted.");
  if (!await store.consumeRateLimit("grant-a:notes.list", 60, 2)) throw new Error("A separate tool shared the wrong bucket.");
});

Deno.test("rate limit bucket identifiers use a stable HMAC with a separate derived key", async () => {
  const first = await hashRateLimitBucket("test-secret", "ip:203.0.113.9:oauth:register");
  const retry = await hashRateLimitBucket("test-secret", "ip:203.0.113.9:oauth:register");
  const otherBucket = await hashRateLimitBucket("test-secret", "ip:203.0.113.9:oauth:token");
  if (!/^[0-9a-f]{64}$/.test(first) || first !== retry || first === otherBucket) {
    throw new Error("Rate limit HMACs were not stable, private, and bucket-specific.");
  }
});

Deno.test("forwarded client address uses the trusted proxy-appended address and rejects malformed headers", () => {
  const request = new Request("https://karenda.example/oauth/register", {
    headers: { "x-forwarded-for": "198.51.100.88, 203.0.113.7" },
  });
  if (forwardedClientAddress(request) !== "203.0.113.7") {
    throw new Error("The rate limiter did not use the proxy-appended client address.");
  }
  const invalid = new Request("https://karenda.example/oauth/register", {
    headers: { "x-forwarded-for": "not-an-ip" },
  });
  if (forwardedClientAddress(invalid) !== null) {
    throw new Error("A malformed forwarded address was accepted.");
  }
});
