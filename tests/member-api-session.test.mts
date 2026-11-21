import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEMBER_API_SESSION_DENIALS,
  memberApiSessionDeniedResponse,
  resolveMemberApiSessionDenial,
} from "../src/lib/member-api-session-policy.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("회원 API 세션 판정은 미로그인과 비밀번호 변경 필요 상태를 구분한다", () => {
  assert.equal(resolveMemberApiSessionDenial(null), "unauthorized");
  assert.equal(resolveMemberApiSessionDenial({ userId: "" }), "unauthorized");
  assert.equal(resolveMemberApiSessionDenial({ userId: "m-1" }), null);
  assert.equal(
    resolveMemberApiSessionDenial({ userId: "m-1", mustChangePassword: true }),
    "password_change_required",
  );
  assert.equal(
    resolveMemberApiSessionDenial(
      { userId: "m-1", mustChangePassword: true },
      { allowPasswordChangeRequired: true },
    ),
    null,
  );
});

test("회원 API 거부 응답은 상태 코드와 사용자 안전 문구를 공용 매핑에서 가져온다", async () => {
  const unauthorized = memberApiSessionDeniedResponse("unauthorized");
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), {
    ok: false,
    error: "unauthorized",
    message: MEMBER_API_SESSION_DENIALS.unauthorized.message,
  });

  const passwordChange = memberApiSessionDeniedResponse("password_change_required");
  assert.equal(passwordChange.status, 403);
  assert.deepEqual(await passwordChange.json(), {
    ok: false,
    error: "password_change_required",
    message: "비밀번호를 변경한 뒤 다시 시도해 주세요.",
  });
});

function listRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRoutes(absolute);
    return entry.name === "route.ts" ? [absolute] : [];
  });
}

// Routes that legitimately read the raw member session for a mutation.
const RAW_SESSION_MUTATION_ALLOWLIST = new Map([
  ["src/app/api/mm/change-password/route.ts", "the forced password change itself"],
  ["src/app/api/mm/logout/route.ts", "signing out must always work"],
  ["src/app/api/mm/consent/route.ts", "checks mustChangePassword and redirects to the password gate"],
]);

test("회원 세션을 읽는 쓰기 API는 비밀번호 변경 필요 상태를 거부한다", () => {
  const routes = listRoutes(path.join(repoRoot, "src/app/api"));
  const offenders: string[] = [];
  for (const absolute of routes) {
    const relative = path.relative(repoRoot, absolute);
    const source = readFileSync(absolute, "utf8");
    const mutates = /export async function (POST|PATCH|PUT|DELETE)\b/.test(source);
    const readsRawMemberSession = /\b(getSignedUserSession|getUserSession)\(\)/.test(source);
    if (!mutates || !readsRawMemberSession) continue;
    if (RAW_SESSION_MUTATION_ALLOWLIST.has(relative)) continue;
    if (/resolveMemberApiSessionDenial\(|mustChangePassword/.test(source)) continue;
    offenders.push(relative);
  }
  assert.deepEqual(offenders, []);

  for (const relative of [
    "src/app/api/certification/photo/route.ts",
    "src/app/api/coupon-issues/[issueId]/redeem/route.ts",
    "src/app/api/coupons/[couponId]/issue/route.ts",
    "src/app/api/member/email/send/route.ts",
    "src/app/api/member/email/verify/route.ts",
    "src/app/api/mm/delete/route.ts",
    "src/app/api/mm/profile-sync/route.ts",
    "src/app/api/notifications/[id]/route.ts",
    "src/app/api/notifications/preferences/route.ts",
    "src/app/api/notifications/route.ts",
    "src/app/api/partners/[id]/benefit-use/route.ts",
    "src/app/api/partners/[id]/favorite/route.ts",
    "src/app/api/push/subscribe/route.ts",
    "src/app/api/push/unsubscribe/route.ts",
  ]) {
    const source = readFileSync(path.join(repoRoot, relative), "utf8");
    assert.match(source, /requireMemberApiSession\(/, relative);
    assert.doesNotMatch(source, /getSignedUserSession\(\)/, relative);
  }
  assert.match(
    readFileSync(path.join(repoRoot, "src/app/api/push/unsubscribe/route.ts"), "utf8"),
    /requireMemberApiSession\(\{ allowPasswordChangeRequired: true \}\)/,
  );
});
