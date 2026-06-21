import assert from "node:assert/strict";
import test from "node:test";

type ConfigModule = typeof import("../src/lib/ssafy-verify/config.ts");
type ServerApiModule = typeof import("../src/lib/ssafy-verify/server-api.ts");

const configModulePromise = import(
  new URL("../src/lib/ssafy-verify/config.ts", import.meta.url).href,
) as Promise<ConfigModule>;

const serverApiModulePromise = import(
  new URL("../src/lib/ssafy-verify/server-api.ts", import.meta.url).href,
) as Promise<ServerApiModule>;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("SSAFY Verify Server API config uses separate confidential credentials", async () => {
  const original = {
    issuer: process.env.SSAFY_VERIFY_ISSUER,
    userClientId: process.env.SSAFY_VERIFY_CLIENT_ID,
    serverClientId: process.env.SSAFY_VERIFY_SERVER_CLIENT_ID,
    serverSecret: process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET,
    baseUrl: process.env.SSAFY_VERIFY_SERVER_API_BASE_URL,
  };

  try {
    process.env.SSAFY_VERIFY_ISSUER = "https://verify.example.com/";
    process.env.SSAFY_VERIFY_CLIENT_ID = "public-pkce-client";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = "server-api-client";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = "server-secret";
    delete process.env.SSAFY_VERIFY_SERVER_API_BASE_URL;

    const { getSsafyVerifyServerApiConfig } = await configModulePromise;
    assert.deepEqual(getSsafyVerifyServerApiConfig(), {
      issuer: "https://verify.example.com",
      apiBaseUrl: "https://verify.example.com/v1",
      clientId: "server-api-client",
      clientSecret: "server-secret",
    });
  } finally {
    restoreEnv("SSAFY_VERIFY_ISSUER", original.issuer);
    restoreEnv("SSAFY_VERIFY_CLIENT_ID", original.userClientId);
    restoreEnv("SSAFY_VERIFY_SERVER_CLIENT_ID", original.serverClientId);
    restoreEnv("SSAFY_VERIFY_SERVER_CLIENT_SECRET", original.serverSecret);
    restoreEnv("SSAFY_VERIFY_SERVER_API_BASE_URL", original.baseUrl);
  }
});

test("SSAFY Verify Server API client caches client_credentials tokens per scope", async () => {
  const { createSsafyVerifyServerApiClient } = await serverApiModulePromise;
  const calls: Array<{
    url: string;
    method: string;
    authorization: string | null;
    idempotencyKey: string | null;
    body: string | null;
  }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      idempotencyKey: headers.get("idempotency-key"),
      body: typeof init?.body === "string" ? init.body : null,
    });

    if (url === "https://verify.example.com/v1/server/token") {
      return jsonResponse({
        access_token: "access-token-1",
        token_type: "Bearer",
        expires_in: 600,
        scope: "ssafy.notify.dm",
      });
    }

    assert.equal(headers.get("authorization"), "Bearer access-token-1");
    return jsonResponse({
      campaign_id: "campaign-1",
      status: "sent",
      request_id: "req_123",
    });
  };

  const client = createSsafyVerifyServerApiClient(
    {
      issuer: "https://verify.example.com",
      apiBaseUrl: "https://verify.example.com/v1",
      clientId: "server-api-client",
      clientSecret: "server-secret",
    },
    { fetch: fetchImpl, now: () => 1_000_000 },
  );

  const input = {
    campaignId: "campaign-1",
    purpose: "announcement",
    templateKey: "ssartnership_admin_notification",
    message: {
      title: "운영 공지",
      body: "본문",
      url: "/notifications",
    },
    recipients: [{ mattermostUserId: "mm.user_123-abc" }],
    idempotencyKey: "campaign-1:mm",
  };

  assert.deepEqual(await client.sendMattermostNotificationBatch(input), {
    notificationId: null,
    campaignId: "campaign-1",
    status: "sent",
    requestId: "req_123",
  });
  assert.deepEqual(await client.sendMattermostNotificationBatch(input), {
    notificationId: null,
    campaignId: "campaign-1",
    status: "sent",
    requestId: "req_123",
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.method, "POST");
  assert.equal(calls[0]?.url, "https://verify.example.com/v1/server/token");
  assert.equal(calls[0]?.authorization, null);
  assert.equal(calls[0]?.idempotencyKey, null);
  const tokenBody = new URLSearchParams(calls[0]?.body ?? "");
  assert.equal(tokenBody.get("grant_type"), "client_credentials");
  assert.equal(tokenBody.get("client_id"), "server-api-client");
  assert.equal(tokenBody.get("client_secret"), "server-secret");
  assert.equal(tokenBody.get("scope"), "ssafy.notify.dm");

  assert.equal(calls[1]?.url, "https://verify.example.com/v1/notifications/mattermost/batch");
  assert.equal(calls[1]?.authorization, "Bearer access-token-1");
  assert.equal(calls[1]?.idempotencyKey, "campaign-1:mm");
  assert.deepEqual(JSON.parse(calls[1]?.body ?? "{}"), {
    campaign_id: "campaign-1",
    purpose: "announcement",
    template_key: "ssartnership_admin_notification",
    message: {
      title: "운영 공지",
      body: "본문",
      url: "/notifications",
    },
    recipients: [{ mattermost_user_id: "mm.user_123-abc" }],
  });
  assert.equal(calls[2]?.url, "https://verify.example.com/v1/notifications/mattermost/batch");
  assert.equal(calls[2]?.authorization, "Bearer access-token-1");
});

test("SSAFY Verify Server API normalizes stable public errors", async () => {
  const {
    SsafyVerifyServerApiError,
    createSsafyVerifyServerApiClient,
  } = await serverApiModulePromise;

  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/server/token")) {
      return jsonResponse({
        access_token: "access-token-1",
        token_type: "Bearer",
        expires_in: 600,
      });
    }

    return jsonResponse(
      {
        error_code: "IDEMPOTENCY_CONFLICT",
        message: "동일 idempotency key로 다른 payload가 요청되었습니다.",
        request_id: "req_unsafe<script>",
        raw_mattermost_response: { internal_status: "not-public" },
      },
      409,
    );
  };

  const client = createSsafyVerifyServerApiClient(
    {
      issuer: "https://verify.example.com",
      apiBaseUrl: "https://verify.example.com/v1",
      clientId: "server-api-client",
      clientSecret: "server-secret",
    },
    { fetch: fetchImpl },
  );

  await assert.rejects(
    () =>
      client.sendMattermostNotification({
        recipient: { mattermostUserId: "mm.user_123" },
        purpose: "announcement",
        templateKey: "ssartnership_admin_notification",
        message: { title: "제목", body: "본문" },
        idempotencyKey: "notice-1:mm",
      }),
    (error) => {
      assert.equal(error instanceof SsafyVerifyServerApiError, true);
      assert.equal((error as InstanceType<typeof SsafyVerifyServerApiError>).status, 409);
      assert.equal(
        (error as InstanceType<typeof SsafyVerifyServerApiError>).errorCode,
        "IDEMPOTENCY_CONFLICT",
      );
      assert.equal(
        (error as InstanceType<typeof SsafyVerifyServerApiError>).message,
        "동일 idempotency key로 다른 payload가 요청되었습니다.",
      );
      assert.equal(
        (error as InstanceType<typeof SsafyVerifyServerApiError>).requestId,
        null,
      );
      assert.equal(
        JSON.stringify(error).includes("raw_mattermost_response"),
        false,
      );
      return true;
    },
  );
});

test("SSAFY Verify Server API validates Mattermost IDs and batch size", async () => {
  const {
    createSsafyVerifyServerApiClient,
    isValidMattermostId,
  } = await serverApiModulePromise;

  assert.equal(isValidMattermostId("abc"), true);
  assert.equal(isValidMattermostId("abc.DEF_123-xyz"), true);
  assert.equal(isValidMattermostId("ab"), false);
  assert.equal(isValidMattermostId("a".repeat(65)), false);
  assert.equal(isValidMattermostId("@abc"), false);
  assert.equal(isValidMattermostId("abc def"), false);

  const client = createSsafyVerifyServerApiClient({
    issuer: "https://verify.example.com",
    apiBaseUrl: "https://verify.example.com/v1",
    clientId: "server-api-client",
    clientSecret: "server-secret",
  });

  await assert.rejects(
    () =>
      client.getMattermostUserProfile("@unsafe"),
    /Mattermost ID는 3~64자의 영문, 숫자, \., _, -만 사용할 수 있습니다\./,
  );

  await assert.rejects(
    () =>
      client.sendMattermostNotificationBatch({
        campaignId: "campaign-1",
        purpose: "announcement",
        templateKey: "ssartnership_admin_notification",
        message: { title: "제목", body: "본문" },
        recipients: Array.from({ length: 26 }, (_, index) => ({
          mattermostUserId: `member-${index + 100}`,
        })),
      }),
    /Mattermost batch 알림은 최대 25명까지 발송할 수 있습니다\./,
  );
});
