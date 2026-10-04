import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PARTNER_SESSION_EXPIRED_ERROR_CODE,
  getPartnerSessionExpiredLoginHref,
  resolvePartnerActionSessionRedirect,
} from "../src/lib/partner-portal-paths.ts";

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
  assert.equal(
    resolvePartnerActionSessionRedirect({ mustChangePassword: true }, "company a"),
    "/partner/change-password?companyId=company%20a",
  );
  assert.equal(resolvePartnerActionSessionRedirect({ mustChangePassword: false }), null);
});

test("파트너 로그인 화면은 session_expired 코드를 안전한 재로그인 안내로 표시한다", async () => {
  const { getLoginErrorMessage, getPartnerLoginFieldErrors } = await import(
    "../src/app/partner/login/_actions/shared.ts"
  );

  assert.match(getLoginErrorMessage("session_expired") ?? "", /세션이 만료되었습니다/);
  assert.deepEqual(getPartnerLoginFieldErrors("session_expired"), {});
  assert.equal(getLoginErrorMessage("arbitrary text"), null);
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
