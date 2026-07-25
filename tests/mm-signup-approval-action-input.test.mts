import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inputModulePromise = import(
  new URL("../src/lib/mm-signup-approval/action-input.ts", import.meta.url).href,
) as Promise<typeof import("../src/lib/mm-signup-approval/action-input.ts")>;

const actionsPath = new URL(
  "../src/app/admin/(protected)/member-signup-requests/actions.ts",
  import.meta.url,
);

test("가입 승인 액션은 유효한 요청 ID만 처리 대상으로 인정한다", async () => {
  const { parseMemberSignupRequestId } = await inputModulePromise;

  assert.equal(
    parseMemberSignupRequestId("bf7eb0c1-9bd7-4f79-a76d-a1ca2e9f9ac8"),
    "bf7eb0c1-9bd7-4f79-a76d-a1ca2e9f9ac8",
  );
  assert.equal(parseMemberSignupRequestId("not-a-request-id"), null);
  assert.equal(parseMemberSignupRequestId(null), null);
});

test("가입 승인 액션은 예상 가능한 잘못된 ID를 throw하지 않고 목록으로 복구한다", async () => {
  const source = await readFile(actionsPath, "utf8");

  assert.match(source, /parseMemberSignupRequestId/);
  assert.match(source, /error: "invalid_fields"/);
  assert.doesNotMatch(source, /throw new Error\("가입 승인 요청 식별자/);
});
