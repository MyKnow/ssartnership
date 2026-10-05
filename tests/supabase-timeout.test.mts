import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { type AddressInfo } from "node:net";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";

import {
  DEFAULT_SUPABASE_FETCH_TIMEOUT_MS,
  DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS,
  getSupabaseRequestTimeoutMs,
  resolveSupabaseFetchTimeouts,
  withSupabaseTimeout,
} from "../src/lib/supabase/timeout.ts";
import { createSupabaseTransport } from "../src/lib/supabase/transport.ts";

async function startServer(
  onRequest: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ close: () => Promise<void>; origin: string; requests: () => string[] }> {
  const seen: string[] = [];
  const server: Server = createServer((request, response) => {
    seen.push(request.url ?? "");
    onRequest(request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests: () => [...seen],
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

// Never answers: models a stalled gateway, PostgREST, or Storage.
const hang = () => undefined;

const shortTimeouts = Object.freeze({ defaultMs: 100, storageMs: 600 });

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.name === "TimeoutError";
}

test("timeout defaults follow the external call budget and env overrides are bounded", () => {
  assert.equal(DEFAULT_SUPABASE_FETCH_TIMEOUT_MS, 30_000);
  assert.equal(DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS, 60_000);
  assert.deepEqual(resolveSupabaseFetchTimeouts({}), {
    defaultMs: 30_000,
    storageMs: 60_000,
  });
  assert.deepEqual(
    resolveSupabaseFetchTimeouts({
      SUPABASE_FETCH_TIMEOUT_MS: "45000",
      SUPABASE_STORAGE_FETCH_TIMEOUT_MS: " 90000 ",
    }),
    { defaultMs: 45_000, storageMs: 90_000 },
  );

  for (const invalid of ["0", "999", "300001", "30s", "1e4", "-5000", "12.5"]) {
    const reported: string[] = [];
    assert.deepEqual(
      resolveSupabaseFetchTimeouts(
        {
          SUPABASE_FETCH_TIMEOUT_MS: invalid,
          SUPABASE_STORAGE_FETCH_TIMEOUT_MS: invalid,
        },
        (name) => reported.push(name),
      ),
      { defaultMs: 30_000, storageMs: 60_000 },
      invalid,
    );
    assert.deepEqual(reported, [
      "SUPABASE_FETCH_TIMEOUT_MS",
      "SUPABASE_STORAGE_FETCH_TIMEOUT_MS",
    ]);
  }

  const reportedBlank: string[] = [];
  resolveSupabaseFetchTimeouts(
    { SUPABASE_FETCH_TIMEOUT_MS: "  " },
    (name) => reportedBlank.push(name),
  );
  assert.deepEqual(reportedBlank, []);
});

test("Storage requests get their own budget while REST, RPC, and Auth share the default", () => {
  const timeouts = { defaultMs: 30_000, storageMs: 60_000 };
  for (const url of [
    "https://db.example.test/rest/v1/partners?select=id",
    "https://db.example.test/rest/v1/rpc/get_partner_review_summary",
    "https://db.example.test/auth/v1/admin/users",
    "https://db.example.test/storage-v1-lookalike/object",
    "not a url",
  ]) {
    assert.equal(getSupabaseRequestTimeoutMs(url, timeouts), 30_000, url);
  }
  for (const input of [
    "https://db.example.test/storage/v1/object/review-media/a.webp",
    new URL("https://db.example.test/storage/v1/object/sign/member-images/a.png"),
    new Request("https://db.example.test/storage/v1/object/move", { method: "POST" }),
  ]) {
    assert.equal(getSupabaseRequestTimeoutMs(input, timeouts), 60_000);
  }
});

test("a stalled Supabase request fails with a TimeoutError instead of hanging", async () => {
  const server = await startServer(hang);
  const timedFetch = withSupabaseTimeout(fetch, shortTimeouts);
  const startedAt = Date.now();
  try {
    await assert.rejects(
      timedFetch(`${server.origin}/rest/v1/rpc/slow_rpc`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      isTimeoutError,
    );
    assert.ok(Date.now() - startedAt < 2_000);
  } finally {
    await server.close();
  }
});

test("Storage calls may run past the REST budget but are still bounded", async () => {
  const server = await startServer((request, response) => {
    if (request.url?.startsWith("/storage/v1/object/slow")) {
      // Slower than the REST budget, faster than the Storage budget.
      setTimeout(() => response.end("ok"), 250);
    }
  });
  const timedFetch = withSupabaseTimeout(fetch, shortTimeouts);
  try {
    const response = await timedFetch(`${server.origin}/storage/v1/object/slow/a.webp`);
    assert.equal(await response.text(), "ok");

    await assert.rejects(
      timedFetch(`${server.origin}/storage/v1/object/hang/a.webp`),
      isTimeoutError,
    );
  } finally {
    await server.close();
  }
});

test("a caller signal still aborts first and keeps its AbortError", async () => {
  const server = await startServer(hang);
  const timedFetch = withSupabaseTimeout(fetch, { defaultMs: 5_000, storageMs: 5_000 });
  try {
    const controller = new AbortController();
    const pending = timedFetch(`${server.origin}/rest/v1/partners`, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(pending, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    });

    const requestController = new AbortController();
    const pendingRequest = timedFetch(
      new Request(`${server.origin}/rest/v1/partners`, {
        signal: requestController.signal,
      }),
    );
    setTimeout(() => requestController.abort(), 20);
    await assert.rejects(pendingRequest, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    });
  } finally {
    await server.close();
  }
});

test("the deadline wraps the private gateway rewrite without changing its target", async () => {
  const publicServer = await startServer((_request, response) => {
    response.statusCode = 500;
    response.end("public origin must not receive rewritten calls");
  });
  const internalServer = await startServer(hang);
  const timedFetch = withSupabaseTimeout(
    createSupabaseTransport(publicServer.origin, internalServer.origin),
    shortTimeouts,
  );
  try {
    await assert.rejects(
      timedFetch(`${publicServer.origin}/rest/v1/partners?select=id`, {
        cache: "no-store",
      }),
      isTimeoutError,
    );
    assert.deepEqual(publicServer.requests(), []);
    assert.deepEqual(internalServer.requests(), ["/rest/v1/partners?select=id"]);
  } finally {
    await internalServer.close();
    await publicServer.close();
  }
});

test("the Supabase SDK returns a transient error object when the deadline fires", async () => {
  const server = await startServer(hang);
  const client = createClient(server.origin, "local-test-key", {
    auth: { persistSession: false },
    global: { fetch: withSupabaseTimeout(fetch, shortTimeouts) },
  });
  const startedAt = Date.now();
  try {
    const { data, error } = await client.rpc("slow_rpc", { input_value: 1 });
    assert.equal(data, null);
    assert.ok(error);
    assert.match(error.message, /^TimeoutError:/u);
    assert.ok(Date.now() - startedAt < 2_000);
  } finally {
    await server.close();
  }
});
