import type { MockScenarioId } from "./registry.ts";
import {
  getPartnerCompanySelectionMockScenario,
  getPartnerDashboardMockScenario,
} from "./partner-portal.ts";

type CompanySelectionStoryScenarioId = Extract<
  MockScenarioId,
  "partner.company.selection.multi-company" | "partner.company.selection.empty"
>;

type DashboardStoryScenarioId = Extract<
  MockScenarioId,
  | "partner.company.dashboard.cafe-ssafy-mixed-plans"
  | "partner.company.dashboard.empty"
  | "partner.company.dashboard.pending-review"
>;

export function getPartnerCompanySelectionStoryScenario(
  scenarioId: CompanySelectionStoryScenarioId,
) {
  return getPartnerCompanySelectionMockScenario(scenarioId);
}

export function getPartnerDashboardStoryScenario(
  scenarioId: DashboardStoryScenarioId,
) {
  return getPartnerDashboardMockScenario(scenarioId);
}
