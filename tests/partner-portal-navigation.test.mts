import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendPartnerPortalSearchParam,
  getCompanyScopedPortalHref,
  getPartnerGlobalPortalHref,
  getPartnerPortalMobileNavigation,
  getPartnerScopedHrefFromLegacyTarget,
} from "../src/lib/partner-portal-paths.ts";

describe("partner portal navigation contract", () => {
  it("keeps dashboard, services, and plans in company scope", () => {
    assert.equal(
      getCompanyScopedPortalHref("company a"),
      "/partner/companies/company%20a",
    );
    assert.equal(
      getCompanyScopedPortalHref("company a", "plans"),
      "/partner/companies/company%20a/plans",
    );
  });

  it("keeps account, notifications, and support global while preserving company context", () => {
    assert.equal(
      getPartnerGlobalPortalHref("notifications", "company a"),
      "/partner/notifications?companyId=company+a",
    );
    assert.equal(
      getPartnerGlobalPortalHref("account", "company a"),
      "/partner/account?companyId=company+a",
    );
    assert.equal(
      getPartnerGlobalPortalHref("support", null),
      "/partner/support",
    );
  });

  it("adds action feedback without corrupting an existing company query", () => {
    assert.equal(
      appendPartnerPortalSearchParam(
        getPartnerGlobalPortalHref("account", "company a"),
        "status",
        "created",
      ),
      "/partner/account?companyId=company+a&status=created",
    );
    assert.equal(
      appendPartnerPortalSearchParam(
        getPartnerGlobalPortalHref("account", "company a"),
        "error",
        "처리 실패",
      ),
      "/partner/account?companyId=company+a&error=%EC%B2%98%EB%A6%AC+%EC%8B%A4%ED%8C%A8",
    );
  });

  it("shows exactly four compact mobile destinations", () => {
    const items = getPartnerPortalMobileNavigation("company-a");

    assert.deepEqual(
      items.map((item) => item.label),
      ["홈", "제휴처", "알림", "더보기"],
    );
    assert.equal(items[0]?.href, "/partner/companies/company-a");
    assert.equal(
      items[1]?.href,
      "/partner/companies/company-a#services",
    );
    assert.equal(
      items[2]?.href,
      "/partner/notifications?companyId=company-a",
    );
  });

  it("does not move global legacy targets back into company routes", () => {
    assert.equal(
      getPartnerScopedHrefFromLegacyTarget(
        "/partner/notifications",
        "company-a",
      ),
      "/partner/notifications?companyId=company-a",
    );
    assert.equal(
      getPartnerScopedHrefFromLegacyTarget("/partner/account", "company-a"),
      "/partner/account?companyId=company-a",
    );
    assert.equal(
      getPartnerScopedHrefFromLegacyTarget("/partner/plans", "company-a"),
      "/partner/companies/company-a/plans",
    );
  });
});
