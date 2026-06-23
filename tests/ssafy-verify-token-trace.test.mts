import assert from "node:assert/strict";
import test from "node:test";

type TokenModule = typeof import("../src/lib/ssafy-verify/token.ts");

const tokenModulePromise = import(
  new URL("../src/lib/ssafy-verify/token.ts", import.meta.url).href,
) as Promise<TokenModule>;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("SSAFY Verify User Auth token exchange emits redacted request and response trace", async () => {
  const { exchangeSsafyVerificationCode } = await tokenModulePromise;
  const traces: unknown[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://verify.example.com/verify/token");
    assert.equal(init?.method, "POST");
    const body = new URLSearchParams(String(init?.body ?? ""));
    assert.equal(body.get("code"), "verify-code-secret");
    assert.equal(body.get("code_verifier"), "pkce-verifier-secret");
    assert.equal(body.get("client_secret"), "client-secret");

    return jsonResponse({
      verification_token: "verification-token-secret-with-minimum-length",
      scope: "ssafy.verify ssafy.name ssafy.mattermost_id",
      result: {
        verification_id: "verify-123",
      },
    });
  };

  const result = await exchangeSsafyVerificationCode(
    {
      code: "verify-code-secret",
      codeVerifier: "pkce-verifier-secret",
      redirectUri: "https://ssartnership.example.com/auth/ssafy",
      iss: "https://verify.example.com",
    },
    {
      issuer: "https://verify.example.com",
      clientId: "public-client",
      clientSecret: "client-secret",
      redirectUris: ["https://ssartnership.example.com/auth/ssafy"],
    },
    {
      fetch: fetchImpl,
      now: () => 0,
      trace: (event) => {
        traces.push(event);
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(traces.length, 1);
  assert.deepEqual(traces[0], {
    source: "user-auth",
    operation: "verification_code_exchange",
    method: "POST",
    path: "/verify/token",
    scopes: [],
    startedAt: "1970-01-01T00:00:00.000Z",
    durationMs: 0,
    status: 200,
    ok: true,
    request: {
      contentType: "application/x-www-form-urlencoded",
      fields: ["grant_type", "client_id", "code", "code_verifier", "client_secret"],
      grantType: "verification_code",
      clientId: "public-client",
      hasClientSecret: true,
      hasCode: true,
      hasCodeVerifier: true,
      scope: null,
    },
    response: {
      keys: ["result", "scope", "verification_token"],
      dataKeys: [],
      errorKeys: [],
      profileKeys: [],
      resultsCount: null,
      targetsCount: null,
      requestId: null,
      errorCode: null,
      status: null,
      campaignId: null,
      notificationId: null,
      hasAccessToken: false,
      hasVerificationToken: true,
      tokenType: null,
      scope: "ssafy.verify ssafy.name ssafy.mattermost_id",
      expiresIn: null,
      verificationId: "verify-123",
    },
    errorCode: null,
    providerRequestId: null,
  });

  const serialized = JSON.stringify(traces);
  assert.equal(serialized.includes("verify-code-secret"), false);
  assert.equal(serialized.includes("pkce-verifier-secret"), false);
  assert.equal(serialized.includes("client-secret"), false);
  assert.equal(serialized.includes("verification-token-secret-with-minimum-length"), false);
});
