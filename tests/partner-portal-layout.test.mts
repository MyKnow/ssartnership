import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPartnerPortalLayoutMode,
  isPartnerCompanySelectionPath,
  shouldShowPartnerPortalMobileNavigation,
  shouldUsePartnerPortalDashboardShell,
} from "../src/lib/partner-portal-layout.ts";

describe("partner portal layout", () => {
  it("keeps the company selection page outside the dashboard shell", () => {
    assert.equal(isPartnerCompanySelectionPath("/partner"), true);
    assert.equal(getPartnerPortalLayoutMode("/partner"), "selection");
    assert.equal(
      shouldUsePartnerPortalDashboardShell({
        pathname: "/partner",
        hasSession: true,
      }),
      false,
    );
    assert.equal(
      shouldShowPartnerPortalMobileNavigation({
        pathname: "/partner",
        hasSession: true,
      }),
      false,
    );
  });

  it("keeps company-scoped portal pages in the dashboard shell", () => {
    assert.equal(
      getPartnerPortalLayoutMode("/partner/companies/company-a"),
      "scoped",
    );
    assert.equal(
      shouldUsePartnerPortalDashboardShell({
        pathname: "/partner/companies/company-a",
        hasSession: true,
      }),
      true,
    );
    assert.equal(
      shouldUsePartnerPortalDashboardShell({
        pathname: "/partner/companies/company-a/notifications",
        hasSession: true,
      }),
      true,
    );
  });

  it("keeps unauthenticated and setup pages outside the dashboard shell", () => {
    assert.equal(
      getPartnerPortalLayoutMode("/partner/login"),
      "auth",
    );
    assert.equal(
      shouldUsePartnerPortalDashboardShell({
        pathname: "/partner/login",
        hasSession: false,
      }),
      false,
    );
    assert.equal(
      shouldUsePartnerPortalDashboardShell({
        pathname: "/partner/setup/demo-token",
        hasSession: true,
      }),
      false,
    );
  });
});
