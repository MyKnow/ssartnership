import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PARTNER_SESSION_EXPIRED_ERROR_CODE } from "../src/lib/partner-auth/portal-paths.ts";
import {
  getPartnerActionReturnTo,
  getPartnerSessionExpiredLoginHref,
  resolvePartnerActionSessionRedirect,
} from "../src/lib/partner-auth/return-to.ts";

const PARTNER_ACTION_FILES = [
  "src/app/partner/account/actions.ts",
  "src/app/partner/plans/actions.ts",
  "src/app/partner/services/[partnerId]/request/_actions/approval.ts",
  "src/app/partner/services/[partnerId]/request/_actions/cancel.ts",
  "src/app/partner/services/[partnerId]/request/_actions/immediate.ts",
];

test("파트너 action 세션 가드는 만료·비밀번호 변경·통과를 구분한다", () => {
  assert.equal(PARTNER_SESSION_EXPIRED_ERROR_CODE, "session_expired");
  assert.equal(getPartnerSessionExpiredLoginHref(), "/partner/login?error=session_expired");
  assert.equal(
    resolvePartnerActionSessionRedirect(null),
    "/partner/login?error=session_expired",
  );
  assert.equal(
    resolvePartnerActionSessionRedirect(undefined),
    "/partner/login?error=session_expired",
  );
  assert.equal(
    resolvePartnerActionSessionRedirect({ mustChangePassword: true }),
    "/partner/change-password",
  );
  assert.equal(resolvePartnerActionSessionRedirect({ mustChangePassword: false }), null);
  assert.equal(
    resolvePartnerActionSessionRedirect(
      { mustChangePassword: false },
      "/partner/account?companyId=company-a",
    ),
    null,
  );
});

test("파트너 action 세션 가드는 제출한 화면을 returnTo로 실어 다시 로그인한 뒤 돌아오게 한다", () => {
  assert.equal(
    resolvePartnerActionSessionRedirect(null, "/partner/account?companyId=company-a"),
    "/partner/login?error=session_expired&returnTo=%2Fpartner%2Faccount%3FcompanyId%3Dcompany-a",
  );
  assert.equal(
    resolvePartnerActionSessionRedirect(
      { mustChangePassword: true },
      "/partner/companies/company-a/plans",
    ),
    "/partner/change-password?returnTo=%2Fpartner%2Fcompanies%2Fcompany-a%2Fplans",
  );
  // The login page reads the same parameter back, so a failed login keeps it.
  const loginUrl = new URL(
    resolvePartnerActionSessionRedirect(null, "/partner/companies/company-a/services/p-1?mode=edit") ?? "",
    "https://partner.example",
  );
  assert.equal(loginUrl.pathname, "/partner/login");
  assert.equal(loginUrl.searchParams.get("error"), "session_expired");
  assert.equal(
    loginUrl.searchParams.get("returnTo"),
    "/partner/companies/company-a/services/p-1?mode=edit",
  );
});

test("파트너 action 복귀 경로는 이전 결과 배너를 지우고 포털 밖·인증 화면은 버린다", () => {
  assert.equal(
    getPartnerActionReturnTo("/partner/account?companyId=company-a&status=created"),
    "/partner/account?companyId=company-a",
  );
  assert.equal(
    getPartnerActionReturnTo(
      "/partner/companies/company-a/services/p-1?mode=edit&success=saved&error=forbidden",
    ),
    "/partner/companies/company-a/services/p-1?mode=edit",
  );
  assert.equal(getPartnerActionReturnTo("/partner/companies/company-a/plans?status=requested"), "/partner/companies/company-a/plans");
  // An action re-posted to the login page forwards that page's own returnTo.
  assert.equal(
    getPartnerActionReturnTo(
      "/partner/login?returnTo=%2Fpartner%2Faccount%3FcompanyId%3Dcompany-a%26status%3Dcreated",
    ),
    "/partner/account?companyId=company-a",
  );
  for (const requestPath of [
    null,
    undefined,
    "",
    "partner/account",
    "//evil.example/partner",
    "https://evil.example/partner/account",
    "/admin/members",
    "/partner/login",
    "/partner/change-password?returnTo=%2Fpartner%2Faccount",
    "/partner/setup/0123456789abcdef",
  ]) {
    assert.equal(getPartnerActionReturnTo(requestPath), null, String(requestPath));
  }
  // The home path is the default destination, so it is not carried.
  assert.equal(
    resolvePartnerActionSessionRedirect(null, "/partner?status=created"),
    "/partner/login?error=session_expired",
  );
});

test("파트너 로그인 화면은 session_expired 코드를 안전한 재로그인 안내로 표시한다", async () => {
  const { getLoginErrorMessage, getPartnerLoginFieldErrors } = await import(
    "../src/app/partner/login/_actions/shared.ts"
  );

  assert.match(getLoginErrorMessage("session_expired") ?? "", /세션이 만료되었습니다/);
  assert.deepEqual(getPartnerLoginFieldErrors("session_expired"), {});
  assert.equal(getLoginErrorMessage("arbitrary text"), null);
});

test("파트너 action 세션 가드는 proxy가 전달한 요청 경로로 제출 화면을 읽는다", async () => {
  const guard = await readFile(
    new URL("../src/lib/partner-action-session.ts", import.meta.url),
    "utf8",
  );
  assert.match(guard, /getForwardedRequestPath\(await headers\(\)\)/);
  assert.match(guard, /resolvePartnerActionSessionRedirect\(session, requestPath\)/);
  assert.doesNotMatch(guard, /["']referer["']/i);
});

test("파트너 server action은 공용 세션 가드로 만료 코드를 붙여 이동한다", async () => {
  for (const path of PARTNER_ACTION_FILES) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(
      source,
      /import \{ requirePartnerActionSession \} from "@\/lib\/partner-action-session";/,
      path,
    );
    assert.match(source, /await requirePartnerActionSession\(\)/, path);
    assert.doesNotMatch(source, /redirect\("\/partner\/login"\)/, path);
    assert.doesNotMatch(source, /redirect\("\/partner\/change-password"\)/, path);
  }
});
