import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type MemberGateRevalidationModule =
  typeof import("../src/lib/member-gate-revalidation.ts");

const modulePromise = import(
  new URL("../src/lib/member-gate-revalidation.ts", import.meta.url).href
) as Promise<MemberGateRevalidationModule>;

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("회원 게이트 무효화는 동의·비밀번호 변경·인증 화면만 한 번씩 무효화한다", async () => {
  const { MEMBER_GATE_REVALIDATE_PATHS, revalidateMemberGatePaths } =
    await modulePromise;
  const calls: string[] = [];

  revalidateMemberGatePaths((path) => calls.push(path));

  assert.deepEqual(calls, [
    "/auth/consent",
    "/auth/change-password",
    "/certification",
  ]);
  assert.deepEqual([...MEMBER_GATE_REVALIDATE_PATHS], calls);
  assert.equal(calls.includes("/"), false);
});

test("회원 인증 라우트는 게이트 무효화 헬퍼를 쓰고 효과 없는 홈 무효화를 하지 않는다", async () => {
  const gateRoutes = [
    "src/app/api/auth/login/route.ts",
    "src/app/api/mm/login/route.ts",
    "src/app/api/mm/consent/route.ts",
    "src/app/api/mm/change-password/route.ts",
  ];
  for (const path of gateRoutes) {
    const source = await read(path);
    assert.match(source, /revalidateMemberGatePaths\(\);/, path);
    assert.doesNotMatch(source, /revalidatePath\(/, path);
  }

  const signup = await read("src/app/api/mm/signup/route.ts");
  assert.doesNotMatch(signup, /revalidatePath\("\/"\)/);
});
