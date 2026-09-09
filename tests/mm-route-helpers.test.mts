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
    MemberAuthRouteBodyError,
    parseResetPasswordCompleteBody,
  } = await parserModulePromise;

  const resetPassword = await parseResetPasswordCompleteBody(
    new Request("http://localhost/api/mm/reset-password/complete", {
      method: "POST",
      body: JSON.stringify({
        nextPassword: "Password123!",
        nextPasswordConfirm: "Password123!",
      }),
      headers: { "Content-Type": "application/json" },
    }),
  );

  assert.deepStrictEqual(resetPassword, {
    nextPassword: "Password123!",
    nextPasswordConfirm: "Password123!",
  });

  await assert.rejects(
    parseResetPasswordCompleteBody(
      new Request("http://localhost/api/mm/reset-password/complete", {
        method: "POST",
        body: JSON.stringify({ nextPassword: "x".repeat(5_000) }),
        headers: { "Content-Type": "application/json" },
      }),
    ),
    (error: unknown) =>
      error instanceof MemberAuthRouteBodyError &&
      error.code === "body_too_large",
  );
});

test("public suggestion and member auth routes share bounded JSON parsing", async () => {
  const root = new URL("..", import.meta.url);
  const read = async (path: string) =>
    (await import("node:fs/promises")).readFile(new URL(path, root), "utf8");
  const [suggest, login, changePassword, consent, resetComplete] =
    await Promise.all([
      read("src/app/api/suggest/route.ts"),
      read("src/app/api/mm/login/route.ts"),
      read("src/app/api/mm/change-password/route.ts"),
      read("src/app/api/mm/consent/route.ts"),
      read("src/app/api/mm/_shared/reset-password-complete.ts"),
    ]);

  assert.match(suggest, /readJsonRequestBodyWithinLimit/);
  assert.match(suggest, /MAX_SUGGEST_JSON_BODY_BYTES = 16 \* 1024/);
  for (const source of [login, changePassword, consent]) {
    assert.match(source, /parseMemberAuthJsonBody/);
    assert.match(source, /error instanceof MemberAuthRouteBodyError/);
  }
  assert.match(resetComplete, /error instanceof MemberAuthRouteBodyError/);
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
