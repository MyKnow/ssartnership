import type { PartnerPortalRepository } from "../partner-portal.ts";
import {
  authenticateMockPartnerPortalLogin,
  changeMockPartnerPortalPassword,
  requestMockPartnerPortalPasswordReset,
} from "./partner-portal/auth.ts";
import { getMockPartnerPortalDashboard } from "./partner-portal/dashboard.ts";
import {
  completeMockPartnerPortalInitialSetup,
  getMockPartnerPortalSetupContext,
  listMockPartnerPortalSetups,
  mockPartnerPortalSetupTokens,
} from "./partner-portal/setup.ts";
import { resetMockPartnerPortalStore } from "./partner-portal/store.ts";

export {
  authenticateMockPartnerPortalLogin,
  changeMockPartnerPortalPassword,
  completeMockPartnerPortalInitialSetup,
  getMockPartnerPortalDashboard,
  getMockPartnerPortalSetupContext,
  listMockPartnerPortalSetups,
  mockPartnerPortalSetupTokens,
  requestMockPartnerPortalPasswordReset,
  resetMockPartnerPortalStore,
};

export const mockPartnerPortalRepository: PartnerPortalRepository = {
  async listDemoSetups() {
    return listMockPartnerPortalSetups();
  },

  async getSetupContext(token: string) {
    return getMockPartnerPortalSetupContext(token);
  },

  async completeInitialSetup(input) {
    return completeMockPartnerPortalInitialSetup(input);
  },
};
