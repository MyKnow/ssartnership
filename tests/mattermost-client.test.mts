import assert from "node:assert/strict";
import test from "node:test";

type MattermostClientModule = typeof import("../src/lib/mattermost/client.ts");

const clientModulePromise = import(
  new URL("../src/lib/mattermost/client.ts", import.meta.url).href,
) as Promise<MattermostClientModule>;

test("MattermostClient는 요청 메모리에서만 세션을 사용하고 DM 뒤 로그아웃한다", async () => {
  const { MattermostClient } = await clientModulePromise;
  const calls: Array<{ path: string; body: unknown; authorization: string | null }> = [];
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(JSON.stringify({ id: "sender-id", username: "sender" }), {
      status: 200,
      headers: { Token: "temporary-token", "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({ id: "dm-channel" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({ id: "post-id" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(null, { status: 200 }),
  ];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push({
      path: new URL(request.url).pathname,
      body: request.headers.get("content-type") === "application/json"
        ? await request.json()
        : null,
      authorization: request.headers.get("authorization"),
    });
    const response = responses.shift();
    assert.ok(response, "unexpected Mattermost request");
    return response;
  };

  try {
    const client = new MattermostClient("https://mattermost.example", 500);
    await client.withAuthenticatedSender(
      { loginId: "sender-login", password: "not-persisted" },
      async (session) => {
        assert.equal(session.user.id, "sender-id");
        await session.sendDirectMessage("recipient-id", "safe test message");
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls.map((call) => call.path), [
    "/api/v4/users/login",
    "/api/v4/channels/direct",
    "/api/v4/posts",
    "/api/v4/users/logout",
  ]);
  assert.equal(calls[0]?.authorization, null);
  assert.equal(calls[1]?.authorization, "Bearer temporary-token");
  assert.equal(calls[2]?.authorization, "Bearer temporary-token");
  assert.equal(calls[3]?.authorization, "Bearer temporary-token");
});

test("MattermostClient는 DM 발송 실패 뒤에도 세션을 로그아웃한다", async () => {
  const { MattermostApiError, MattermostClient } = await clientModulePromise;
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  const responses = [
    new Response(JSON.stringify({ id: "sender-id", username: "sender" }), {
      status: 200,
      headers: { Token: "temporary-token", "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({ id: "dm-channel" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(null, { status: 503 }),
    new Response(null, { status: 200 }),
  ];
  globalThis.fetch = async (input) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    paths.push(new URL(url).pathname);
    const response = responses.shift();
    assert.ok(response, "unexpected Mattermost request");
    return response;
  };

  try {
    const client = new MattermostClient("https://mattermost.example", 500);
    await assert.rejects(
      () => client.withAuthenticatedSender(
        { loginId: "sender-login", password: "not-persisted" },
        (session) => session.sendDirectMessage("recipient-id", "safe test message"),
      ),
      (error: unknown) => error instanceof MattermostApiError && error.code === "unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(paths.at(-1), "/api/v4/users/logout");
});
