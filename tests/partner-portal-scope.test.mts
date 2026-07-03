import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCompanyScopedPartnerServiceHref,
  getCompanyScopedPortalHref,
  getPartnerCompanyIdFromPathname,
  getPartnerCompanyIdFromSearchParams,
  getPartnerPasswordChangeHref,
} from "../src/lib/partner-portal-paths.ts";
import {
  isPartnerPortalCompanyAllowed,
  normalizePartnerPortalCompanyIds,
} from "../src/lib/partner-portal-scope.ts";
import type { PartnerSession } from "../src/lib/partner-session.ts";

function createSession(companyIds: string[]): PartnerSession {
  return {
    accountId: "account-1",
    loginId: "partner@example.com",
    displayName: "파트너 담당자",
    companyIds,
    mustChangePassword: false,
    issuedAt: 1,
    expiresAt: Date.now() + 1000,
  };
}

describe("partner portal company scope", () => {
  it("normalizes company ids without mutating order or keeping duplicates", () => {
    assert.deepEqual(
      normalizePartnerPortalCompanyIds([" company-a ", "", "company-b", "company-a"]),
      ["company-a", "company-b"],
    );
  });

  it("checks selected company access against the signed partner session", () => {
    const session = createSession(["company-a", "company-b"]);

    assert.equal(isPartnerPortalCompanyAllowed(session, "company-a"), true);
    assert.equal(isPartnerPortalCompanyAllowed(session, "company-c"), false);
    assert.equal(isPartnerPortalCompanyAllowed(null, "company-a"), false);
  });

  it("builds stable scoped portal and service hrefs", () => {
    assert.equal(
      getCompanyScopedPortalHref("company a", "dashboard"),
      "/partner/companies/company%20a",
    );
    assert.equal(
      getCompanyScopedPortalHref("company-a", "notifications"),
      "/partner/companies/company-a/notifications",
    );
    assert.equal(
      getCompanyScopedPortalHref("company-a", "plans"),
      "/partner/companies/company-a/plans",
    );
    assert.equal(
      getCompanyScopedPortalHref("company-a", "support"),
      "/partner/companies/company-a/support",
    );
    assert.equal(
      getCompanyScopedPartnerServiceHref("company-a", "partner/b"),
      "/partner/companies/company-a/services/partner%2Fb",
    );
    assert.equal(
      getPartnerPasswordChangeHref("company-a"),
      "/partner/change-password?companyId=company-a",
    );
    assert.equal(getPartnerPasswordChangeHref(null), "/partner/change-password");
  });

  it("extracts company id from scoped portal paths", () => {
    assert.equal(
      getPartnerCompanyIdFromPathname("/partner/companies/company%20a/services/service-1"),
      "company a",
    );
    assert.equal(getPartnerCompanyIdFromPathname("/partner"), null);
    assert.equal(getPartnerCompanyIdFromPathname("/partner/companies"), null);
  });

  it("extracts company id from password change search params", () => {
    assert.equal(
      getPartnerCompanyIdFromSearchParams(
        new URLSearchParams("companyId=company%20a"),
      ),
      "company a",
    );
    assert.equal(
      getPartnerCompanyIdFromSearchParams(new URLSearchParams("companyId=+")),
      null,
    );
    assert.equal(getPartnerCompanyIdFromSearchParams(null), null);
  });
});
