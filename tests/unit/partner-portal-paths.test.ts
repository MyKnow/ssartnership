import { describe, expect, it } from "vitest";
import {
  appendPartnerPortalSearchParam,
  getCompanyScopedPartnerServiceEditHref,
  getCompanyScopedPartnerServiceHref,
  getCompanyScopedPartnerServiceNewHref,
  getCompanyScopedPortalHref,
  getPartnerCompanyIdFromPathname,
  getPartnerCompanyIdFromSearchParams,
  getPartnerGlobalPortalHref,
  getPartnerPasswordChangeHref,
  getPartnerPortalMobileNavigation,
  getPartnerScopedHrefFromLegacyTarget,
} from "@/lib/partner-portal-paths";

describe("partner portal canonical paths", () => {
  it("builds global and company-scoped destinations", () => {
    expect(getPartnerGlobalPortalHref("account", " company a ")).toBe(
      "/partner/account?companyId=company+a",
    );
    expect(getPartnerGlobalPortalHref("support", null)).toBe("/partner/support");
    expect(getCompanyScopedPortalHref("company/a")).toBe(
      "/partner/companies/company%2Fa",
    );
    expect(getCompanyScopedPortalHref("company-a", "services")).toBe(
      "/partner/companies/company-a#services",
    );
    expect(getCompanyScopedPortalHref("company-a", "plans")).toBe(
      "/partner/companies/company-a/plans",
    );
    expect(getCompanyScopedPortalHref("company-a", "notifications")).toBe(
      "/partner/notifications?companyId=company-a",
    );
    expect(getCompanyScopedPortalHref("company-a", "account")).toBe(
      "/partner/account?companyId=company-a",
    );
    expect(getCompanyScopedPortalHref("company-a", "support")).toBe(
      "/partner/support?companyId=company-a",
    );
  });

  it("builds service, feedback, and password paths safely", () => {
    expect(getCompanyScopedPartnerServiceHref("c 1", "p/1")).toBe(
      "/partner/companies/c%201/services/p%2F1",
    );
    expect(getCompanyScopedPartnerServiceNewHref("c 1")).toBe(
      "/partner/companies/c%201/services/new",
    );
    expect(getCompanyScopedPartnerServiceEditHref("c 1", "p/1")).toContain(
      "?mode=edit",
    );
    expect(
      appendPartnerPortalSearchParam(
        "/partner/account?companyId=c+1#billing",
        "error",
        "profile_create_failed",
      ),
    ).toBe(
      "/partner/account?companyId=c+1&error=profile_create_failed#billing",
    );
    expect(getPartnerPasswordChangeHref("c 1")).toBe(
      "/partner/change-password?companyId=c%201",
    );
    expect(getPartnerPasswordChangeHref("  ")).toBe("/partner/change-password");
  });

  it("reads company context and rejects malformed path encoding", () => {
    expect(
      getPartnerCompanyIdFromPathname("/partner/companies/company%20a/services"),
    ).toBe("company a");
    expect(getPartnerCompanyIdFromPathname("/partner/account")).toBeNull();
    expect(getPartnerCompanyIdFromPathname("/partner/companies/")).toBeNull();
    expect(
      getPartnerCompanyIdFromPathname("/partner/companies/%E0%A4%A"),
    ).toBeNull();
    expect(
      getPartnerCompanyIdFromSearchParams(new URLSearchParams("companyId=c+1")),
    ).toBe("c 1");
    expect(getPartnerCompanyIdFromSearchParams(null)).toBeNull();
  });

  it("normalizes legacy targets and mobile navigation", () => {
    expect(getPartnerScopedHrefFromLegacyTarget(null, "company-a")).toBeNull();
    expect(getPartnerScopedHrefFromLegacyTarget("/partner", "company-a")).toBe(
      "/partner/companies/company-a",
    );
    expect(
      getPartnerScopedHrefFromLegacyTarget("/partner/plans", "company-a"),
    ).toBe("/partner/companies/company-a/plans");
    expect(
      getPartnerScopedHrefFromLegacyTarget(
        "/partner/services/p%201?mode=edit",
        "company-a",
      ),
    ).toBe("/partner/companies/company-a/services/p%201?mode=edit");
    expect(
      getPartnerScopedHrefFromLegacyTarget(
        "/partner/services/%E0%A4%A",
        "company-a",
      ),
    ).toBe("/partner/services/%E0%A4%A");
    expect(
      getPartnerScopedHrefFromLegacyTarget("/unrelated", "company-a"),
    ).toBe("/unrelated");
    expect(getPartnerPortalMobileNavigation(null).map((item) => item.label)).toEqual(
      ["홈", "제휴처", "알림", "더보기"],
    );
  });
});
