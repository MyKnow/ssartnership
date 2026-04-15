import assert from "node:assert/strict";
import test from "node:test";

type ParserModule = typeof import("../src/app/api/mm/_shared/parsers.ts");
type ThrottleModule = typeof import("../src/app/api/mm/_shared/throttle.ts");
type ResponseModule = typeof import("../src/app/api/mm/_shared/responses.ts");

const parserModulePromise = import(
  new URL("../src/app/api/mm/_shared/parsers.ts", import.meta.url).href,
) as Promise<ParserModule>;
const throttleModulePromise = import(
  new URL("../src/app/api/mm/_shared/throttle.ts", import.meta.url).href,
) as Promise<ThrottleModule>;
const responseModulePromise = import(
  new URL("../src/app/api/mm/_shared/responses.ts", import.meta.url).href,
) as Promise<ResponseModule>;

test("MM route parsers preserve request payload shapes", async () => {
  const {
    parseRequestCodeBody,
    parseVerifyCodeBody,
    parseResetPasswordBody,
  } = await parserModulePromise;

  const requestCode = await parseRequestCodeBody(
    new Request("http://localhost/api/mm/request-code", {
      method: "POST",
      body: JSON.stringify({ username: "student", year: "15" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  const verifyCode = await parseVerifyCodeBody(
    new Request("http://localhost/api/mm/verify-code", {
      method: "POST",
      body: JSON.stringify({
        username: "student",
        code: "ABC123",
        password: "Strong!123",
        servicePolicyId: "service",
        privacyPolicyId: "privacy",
      }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  const resetPassword = await parseResetPasswordBody(
    new Request("http://localhost/api/mm/reset-password", {
      method: "POST",
      body: JSON.stringify({ username: "student" }),
      headers: { "Content-Type": "application/json" },
    }),
  );

  assert.deepStrictEqual(requestCode, { username: "student", year: "15" });
  assert.equal(verifyCode.code, "ABC123");
  assert.equal(verifyCode.servicePolicyId, "service");
  assert.deepStrictEqual(resetPassword, { username: "student" });
});

test("MM route helpers expose deterministic throttle context and response mapping", async () => {
  const { createMemberAuthThrottleContext } = await throttleModulePromise;
  const { mmErrorResponse, mmOkResponse } = await responseModulePromise;

  assert.deepStrictEqual(
    createMemberAuthThrottleContext("127.0.0.1", "student"),
    {
      ipAddress: "127.0.0.1",
      accountIdentifier: "student",
    },
  );

  const errorResponse = mmErrorResponse("blocked", 429, "잠시 후 다시 시도해 주세요.");
  assert.equal(errorResponse.status, 429);
  assert.deepStrictEqual(await errorResponse.json(), {
    error: "blocked",
    message: "잠시 후 다시 시도해 주세요.",
  });

  const okResponse = mmOkResponse({ ok: true, redirectTo: "/" });
  assert.equal(okResponse.status, 200);
  assert.deepStrictEqual(await okResponse.json(), {
    ok: true,
    redirectTo: "/",
  });
  assert.equal((await throttleModulePromise).getMemberAuthBlockedScope(null), "ip");
});
