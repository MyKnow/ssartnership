import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const partnerPlanBrandListSourceUrl = new URL(
  "../src/components/partner/PartnerPlanBrandList.tsx",
  import.meta.url,
);
const partnerPlanManagementViewSourceUrl = new URL(
  "../src/components/partner/PartnerPlanManagementView.tsx",
  import.meta.url,
);
const adminCompanyPlanManagerSourceUrl = new URL(
  "../src/components/admin/AdminCompanyPlanManager.tsx",
  import.meta.url,
);
const partnerDashboardViewSourceUrl = new URL(
  "../src/components/partner/PartnerDashboardView.tsx",
  import.meta.url,
);
const partnerServiceDetailSourceUrl = new URL(
  "../src/components/partner/partner-service-detail-view/PartnerServiceDetailViewContent.tsx",
  import.meta.url,
);
const partnerSetupCompanySectionSourceUrl = new URL(
  "../src/app/partner/setup/[token]/_page/PartnerSetupCompanySection.tsx",
  import.meta.url,
);

test("partner plan badge mapping is reused from the shared helper", async () => {
  const sources = await Promise.all([
    readFile(partnerPlanBrandListSourceUrl, "utf8"),
    readFile(partnerPlanManagementViewSourceUrl, "utf8"),
    readFile(adminCompanyPlanManagerSourceUrl, "utf8"),
    readFile(partnerDashboardViewSourceUrl, "utf8"),
    readFile(partnerServiceDetailSourceUrl, "utf8"),
  ]);

  for (const source of sources) {
    assert.match(source, /getPartnerPlanBadgeVariant/);
    assert.doesNotMatch(
      source,
      /boost"\s*\?\s*"primary"\s*:\s*.*partner"\s*\?\s*"success"\s*:\s*"neutral"/,
    );
  }
});

test("partner plan date and expiry day helpers are reused from the shared helper", async () => {
  const [brandListSource, managementSource, adminSource] = await Promise.all([
    readFile(partnerPlanBrandListSourceUrl, "utf8"),
    readFile(partnerPlanManagementViewSourceUrl, "utf8"),
    readFile(adminCompanyPlanManagerSourceUrl, "utf8"),
  ]);

  assert.match(brandListSource, /formatPartnerPlanDateTime/);
  assert.match(brandListSource, /getPartnerPlanDaysUntil/);
  assert.doesNotMatch(brandListSource, /function formatDateTime\(/);
  assert.doesNotMatch(brandListSource, /function getDaysUntil\(/);

  assert.match(managementSource, /formatPartnerPlanDateTime/);
  assert.match(managementSource, /getPartnerPlanDaysUntil/);
  assert.doesNotMatch(managementSource, /function formatDateTime\(/);
  assert.doesNotMatch(managementSource, /function getDaysUntil\(/);

  assert.match(adminSource, /formatPartnerPlanDateTime/);
  assert.doesNotMatch(adminSource, /function formatDateTime\(/);
});

test("partner visibility copy uses the shared domain label without local drift", async () => {
  const [brandListSource, setupSource] = await Promise.all([
    readFile(partnerPlanBrandListSourceUrl, "utf8"),
    readFile(partnerSetupCompanySectionSourceUrl, "utf8"),
  ]);

  assert.match(brandListSource, /getPartnerVisibilityLabel\(brand\.visibility\)/);
  assert.doesNotMatch(brandListSource, /function getVisibilityLabel\(/);
  assert.doesNotMatch(brandListSource, /검토용/);

  assert.match(setupSource, /getPartnerVisibilityLabel\(service\.visibility\)/);
  assert.match(setupSource, /getPartnerVisibilityBadgeClass\(service\.visibility\)/);
  assert.doesNotMatch(setupSource, /검토용/);
});
