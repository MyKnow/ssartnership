import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PARTNER_LOGIN_PATH,
  getPartnerSessionExpiredLoginHref,
} from "../src/lib/partner-auth/portal-paths.ts";
import {
  getPartnerLoginHref,
  getPartnerPasswordChangeGateHref,
  getPartnerRequestReturnTo,
  resolvePartnerPostLoginHref,
  sanitizePartnerReturnTo,
} from "../src/lib/partner-auth/return-to.ts";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("partner returnTo allowlist", () => {
  it("keeps partner portal deep links with their query", () => {
    assert.equal(sanitizePartnerReturnTo("/partner"), "/partner");
    assert.equal(
      sanitizePartnerReturnTo("/partner/companies/company-a/plans"),
      "/partner/companies/company-a/plans",
    );
    assert.equal(
      sanitizePartnerReturnTo(" /partner/notifications?companyId=company-a&tab=unread#top "),
      "/partner/notifications?companyId=company-a&tab=unread",
    );
  });

  it("rejects external, protocol-relative, malformed, and non-partner destinations", () => {
    for (const candidate of [
      undefined,
      null,
      42,
      "",
      "https://evil.example/partner",
      "http://ssartnership.myknow.xyz/partner",
      "//evil.example/partner",
      "/\\evil.example/partner",
      "\\\\evil.example",
      "javascript:alert(1)",
      "partner/companies",
      "/partnership",
      "/partners/abc",
      "/admin",
      "/auth/login?returnTo=/partner",
      "/partner/../admin",
      "/partner/%2e%2e/admin",
      "/partner/companies\n/evil",
      "/partner/companies/a b",
      `/partner/${"a".repeat(1100)}`,
    ]) {
      assert.equal(sanitizePartnerReturnTo(candidate), null, String(candidate));
    }
  });

  it("never returns an auth page as a completion destination", () => {
    for (const candidate of [
      "/partner/login",
      "/partner/login?returnTo=%2Fpartner%2Faccount",
      "/partner/logout",
      "/partner/reset",
      "/partner/setup",
      "/partner/setup/0123456789abcdef",
      "/partner/change-password?returnTo=%2Fpartner",
    ]) {
      assert.equal(sanitizePartnerReturnTo(candidate), null, candidate);
    }
  });
});

describe("partner login and password gate hrefs", () => {
  it("adds returnTo only for a non-home partner destination", () => {
    assert.equal(
      getPartnerLoginHref("/partner/reviews?page=2"),
      "/partner/login?returnTo=%2Fpartner%2Freviews%3Fpage%3D2",
    );
    assert.equal(getPartnerLoginHref("/partner"), "/partner/login");
    assert.equal(getPartnerLoginHref("https://evil.example"), "/partner/login");
    assert.equal(getPartnerLoginHref(null), "/partner/login");
    assert.equal(
      getPartnerPasswordChangeGateHref("/partner/companies/a"),
      "/partner/change-password?returnTo=%2Fpartner%2Fcompanies%2Fa",
    );
    assert.equal(getPartnerPasswordChangeGateHref("//evil.example"), "/partner/change-password");
  });

  it("forwards the login page's own returnTo instead of the login URL", () => {
    assert.equal(
      getPartnerRequestReturnTo("/partner/login", "?returnTo=%2Fpartner%2Faccount%3FcompanyId%3Da"),
      "/partner/account?companyId=a",
    );
    assert.equal(
      getPartnerRequestReturnTo("/partner/login", "?returnTo=https%3A%2F%2Fevil.example"),
      null,
    );
    assert.equal(
      getPartnerRequestReturnTo("/partner/companies/a", "?tab=services"),
      "/partner/companies/a?tab=services",
    );
    assert.equal(getPartnerRequestReturnTo("/partner/reset", ""), null);
  });

  it("puts the forced password change ahead of the original destination", () => {
    assert.equal(
      resolvePartnerPostLoginHref({
        mustChangePassword: true,
        returnTo: "/partner/companies/a",
      }),
      "/partner/change-password?returnTo=%2Fpartner%2Fcompanies%2Fa",
    );
    assert.equal(
      resolvePartnerPostLoginHref({ mustChangePassword: true }),
      "/partner/change-password",
    );
    assert.equal(
      resolvePartnerPostLoginHref({
        mustChangePassword: false,
        returnTo: "/partner/companies/a",
      }),
      "/partner/companies/a",
    );
    assert.equal(
      resolvePartnerPostLoginHref({ mustChangePassword: false, returnTo: "/admin" }),
      "/partner",
    );
  });
});

describe("partner login path", () => {
  it("shares one login path across returnTo, session expiry and login error redirects", async () => {
    const returnToModule = await import("../src/lib/partner-auth/return-to.ts");
    const { buildPartnerLoginErrorRedirect } = await import(
      "../src/app/partner/login/_actions/shared.ts"
    );

    assert.equal("PARTNER_LOGIN_PAGE_PATH" in returnToModule, false);
    assert.equal(PARTNER_LOGIN_PATH, "/partner/login");
    assert.equal(getPartnerLoginHref(), PARTNER_LOGIN_PATH);
    assert.equal(
      getPartnerRequestReturnTo(PARTNER_LOGIN_PATH, "?returnTo=%2Fpartner%2Fplans"),
      "/partner/plans",
    );
    assert.equal(
      new URL(getPartnerSessionExpiredLoginHref(), "https://partner.example").pathname,
      PARTNER_LOGIN_PATH,
    );
    assert.equal(
      buildPartnerLoginErrorRedirect("server_error", "partner@example.com", "/partner/plans"),
      "/partner/login?error=server_error&loginId=partner%40example.com&returnTo=%2Fpartner%2Fplans",
    );
  });
});

describe("partner returnTo wiring", () => {
  it("validates returnTo again in the login action, page, and password gate", () => {
    const action = readSource("src/app/partner/login/_actions/login.ts");
    const page = readSource("src/app/partner/login/page.tsx");
    const screen = readSource("src/components/partner/PartnerLoginScreen.tsx");
    const changePassword = readSource("src/app/partner/change-password/page.tsx");
    const proxy = readSource("src/proxy.ts");

    assert.match(action, /sanitizePartnerReturnTo\(formData\.get\("returnTo"\)\)/);
    assert.match(action, /resolvePartnerPostLoginHref\(\{\s*mustChangePassword: result\.account\.mustChangePassword,\s*returnTo,/);
    assert.match(action, /buildPartnerLoginErrorRedirect\(errorCode, loginId, returnTo\)/);
    assert.doesNotMatch(action, /"\/partner\/change-password"/);
    assert.match(page, /sanitizePartnerReturnTo\(readSearchParam\(params\.returnTo\)\)/);
    assert.match(screen, /<input type="hidden" name="returnTo" value=\{returnTo\} \/>/);
    assert.match(changePassword, /sanitizePartnerReturnTo\(getSingleSearchParam\(params\.returnTo\)\)/);
    assert.match(changePassword, /returnTo \?\?\s*\(returnCompanyId/);
    // The forced-change copy must not promise the dashboard when the deep
    // link wins.
    assert.match(changePassword, /\? returnTo\s*\? "[^"]*원래 열려던 화면으로 이동합니다\."/);
    assert.match(proxy, /getPartnerLoginHref\(partnerReturnTo\)/);
    assert.match(proxy, /getPartnerPasswordChangeGateHref\(partnerReturnTo\)/);
  });
});
