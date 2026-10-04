import assert from "node:assert/strict";
import test from "node:test";

type MattermostClientModule = typeof import("../src/lib/mattermost/client.ts");

const clientModulePromise = import(
  new URL("../src/lib/mattermost/client.ts", import.meta.url).href,
) as Promise<MattermostClientModule>;

type FetchStep = "hang" | Response;

function installFetch(steps: Record<string, FetchStep[]>) {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(new Request(input, init).url).pathname;
    calls.push(path);
    const step = steps[path]?.shift();
    assert.ok(step, `unexpected Mattermost request ${path}`);
    if (step === "hang") {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }
    return step;
  };
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

test("조회 요청은 timeout 1회를 재시도해 성공하면 결과를 돌려준다", async () => {
  const { MattermostClient } = await clientModulePromise;
  const fetchMock = installFetch({
    "/api/v4/users/user-1": ["hang", jsonResponse({ id: "user-1", username: "member" })],
  });
  try {
    const client = new MattermostClient("https://mattermost.example", 20);
    const user = await client.getUserById("token", "user-1");
    assert.equal(user.id, "user-1");
  } finally {
    fetchMock.restore();
  }
  assert.deepEqual(fetchMock.calls, ["/api/v4/users/user-1", "/api/v4/users/user-1"]);
});

test("조회 요청이 두 번 연속 timeout이면 timeout 오류로 끝난다", async () => {
  const { MattermostApiError, MattermostClient } = await clientModulePromise;
  const fetchMock = installFetch({ "/api/v4/users/user-1": ["hang", "hang"] });
  try {
    const client = new MattermostClient("https://mattermost.example", 20);
    await assert.rejects(
      client.getUserById("token", "user-1"),
      (error: unknown) => error instanceof MattermostApiError && error.code === "timeout",
    );
  } finally {
    fetchMock.restore();
  }
  assert.equal(fetchMock.calls.length, 2);
});

test("Sender 로그인 timeout은 1회 재시도한다", async () => {
  const { MattermostClient } = await clientModulePromise;
  const fetchMock = installFetch({
    "/api/v4/users/login": [
      "hang",
      jsonResponse({ id: "sender-id", username: "sender" }, { headers: { Token: "token" } }),
    ],
    "/api/v4/users/logout": [new Response(null, { status: 200 })],
  });
  try {
    const client = new MattermostClient("https://mattermost.example", 20);
    const userId = await client.withAuthenticatedSender(
      { loginId: "sender-login", password: "not-persisted" },
      async (session) => session.user.id,
    );
    assert.equal(userId, "sender-id");
  } finally {
    fetchMock.restore();
  }
  assert.deepEqual(fetchMock.calls, [
    "/api/v4/users/login",
    "/api/v4/users/login",
    "/api/v4/users/logout",
  ]);
});

test("DM 게시는 중복 발송을 막기 위해 timeout을 재시도하지 않는다", async () => {
  const { MattermostApiError, MattermostClient } = await clientModulePromise;
  const fetchMock = installFetch({
    "/api/v4/channels/direct": ["hang", jsonResponse({ id: "dm-channel" }, { status: 201 })],
    "/api/v4/posts": ["hang"],
  });
  try {
    const client = new MattermostClient("https://mattermost.example", 20);
    await assert.rejects(
      client.sendDirectMessage("token", "sender-id", "recipient-id", "본문"),
      (error: unknown) => error instanceof MattermostApiError && error.code === "timeout",
    );
  } finally {
    fetchMock.restore();
  }
  assert.deepEqual(fetchMock.calls, [
    "/api/v4/channels/direct",
    "/api/v4/channels/direct",
    "/api/v4/posts",
  ]);
});
