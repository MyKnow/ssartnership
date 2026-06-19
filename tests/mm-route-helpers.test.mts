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
  const { parseResetPasswordCompleteBody } = await parserModulePromise;
  const sampleCompletionToken = ["completion", "sample"].join("-");

  const resetPassword = await parseResetPasswordCompleteBody(
    new Request("http://localhost/api/mm/reset-password/complete", {
      method: "POST",
      body: JSON.stringify({
        token: sampleCompletionToken,
        nextPassword: "Password123!",
        nextPasswordConfirm: "Password123!",
      }),
      headers: { "Content-Type": "application/json" },
    }),
  );

  assert.deepStrictEqual(resetPassword, {
    token: sampleCompletionToken,
    nextPassword: "Password123!",
    nextPasswordConfirm: "Password123!",
  });
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
