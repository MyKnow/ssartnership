import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminCompanyPlanManagerSourceUrl = new URL(
  "../src/components/admin/AdminCompanyPlanManager.tsx",
  import.meta.url,
);
const adminPlanWindowFieldsSourceUrl = new URL(
  "../src/components/admin/AdminPlanWindowFields.tsx",
  import.meta.url,
);
const adminPlanActionsSourceUrl = new URL(
  "../src/app/admin/(protected)/_actions/plan-actions.ts",
  import.meta.url,
);

test("administrator plan edits preserve render-time version and validate the window before submit", async () => {
  const [managerSource, fieldsSource, actionSource] = await Promise.all([
    readFile(adminCompanyPlanManagerSourceUrl, "utf8"),
    readFile(adminPlanWindowFieldsSourceUrl, "utf8"),
    readFile(adminPlanActionsSourceUrl, "utf8"),
  ]);

  assert.match(managerSource, /name="expectedPlanTier" value=\{brand\.planTier\}/);
  assert.match(managerSource, /name="expectedPlanUpdatedAt"/);
  assert.match(fieldsSource, /isPartnerPlanWindowOrderValid/);
  assert.match(fieldsSource, /setCustomValidity/);
  assert.match(actionSource, /isPartnerPlanWindowOrderValid/);
  assert.match(actionSource, /expectedPlanTier: parsePlanTier/);
  assert.match(actionSource, /expectedPlanUpdatedAt: parseNullableIsoTimestamp/);
});
