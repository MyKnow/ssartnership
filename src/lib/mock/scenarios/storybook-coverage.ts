import type { MockStorybookScenarioCoverage } from "./types.ts";

export const mockStorybookScenarioCoverage = [
  {
    routePath: "/admin",
    scenarioId: "admin.dashboard.default",
    storyId: "domains-admin-pagestates--dashboard-overview",
    storyFile: "src/components/admin/AdminPageStates.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/companies",
    scenarioId: "admin.company.billing",
    storyId: "domains-admin-pagestates--company-billing",
    storyFile: "src/components/admin/AdminPageStates.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/logs",
    scenarioId: "admin.logs.list",
    storyId: "domains-admin-adminlogsmanager--default",
    storyFile: "src/components/admin/AdminLogsManager.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/notifications",
    scenarioId: "admin.notifications.inbox",
    storyId: "domains-admin-pagestates--notifications-inbox",
    storyFile: "src/components/admin/AdminPageStates.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/partners",
    scenarioId: "admin.partners.list",
    storyId: "domains-admin-adminpartnermanager--default",
    storyFile: "src/components/admin/AdminPartnerManager.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/partners/[partnerId]",
    scenarioId: "admin.partners.editor",
    storyId: "domains-admin-pagestates--partner-editor",
    storyFile: "src/components/admin/AdminPageStates.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/partners/new",
    scenarioId: "admin.partners.editor",
    storyId: "domains-admin-pagestates--partner-editor",
    storyFile: "src/components/admin/AdminPageStates.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/push",
    scenarioId: "admin.push.default",
    storyId: "domains-admin-adminpushmanager--default",
    storyFile: "src/components/admin/AdminPushManager.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/admin/reviews",
    scenarioId: "admin.reviews.default",
    storyId: "domains-admin-adminreviewmanager--default",
    storyFile: "src/components/admin/AdminReviewManager.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/partner",
    scenarioId: "partner.company.selection.multi-company",
    storyId: "domains-partner-pagestates-companyselection--multi-company",
    storyFile: "src/components/partner/PartnerCompanySelectionView.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/partner",
    scenarioId: "partner.company.selection.empty",
    storyId: "domains-partner-pagestates-companyselection--empty",
    storyFile: "src/components/partner/PartnerCompanySelectionView.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/partner/companies/[companyId]",
    scenarioId: "partner.company.dashboard.cafe-ssafy-mixed-plans",
    storyId: "domains-partner-pagestates-dashboard--cafe-ssafy-mixed-plans",
    storyFile: "src/components/partner/PartnerDashboardView.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/partner/companies/[companyId]",
    scenarioId: "partner.company.dashboard.empty",
    storyId: "domains-partner-pagestates-dashboard--empty",
    storyFile: "src/components/partner/PartnerDashboardView.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
  {
    routePath: "/partner/companies/[companyId]",
    scenarioId: "partner.company.dashboard.pending-review",
    storyId: "domains-partner-pagestates-dashboard--pending-review",
    storyFile: "src/components/partner/PartnerDashboardView.stories.tsx",
    viewportKeys: ["mobile-360", "tablet-820", "desktop-1366"],
  },
] as const satisfies MockStorybookScenarioCoverage[];

export function listMockStorybookScenarioCoverage() {
  return mockStorybookScenarioCoverage.map((entry) => ({
    ...entry,
    viewportKeys: [...entry.viewportKeys],
  }));
}
