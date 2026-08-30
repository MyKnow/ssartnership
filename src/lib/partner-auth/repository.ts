import {
  isPartnerPortalMock,
  type PartnerPortalRepository,
  type PartnerPortalDemoSetupSummary,
} from "../partner-portal.ts";
import { mockPartnerPortalRepository } from "../mock/partner-portal.ts";
import { authenticateSupabasePartnerPortalLogin } from "./login.ts";
import { changeSupabasePartnerPortalPassword } from "./password.ts";
import {
  requestSupabasePartnerPortalPasswordReset,
} from "./reset.ts";
import {
  completeSupabasePartnerPortalInitialSetup,
  getSupabasePartnerPortalSetupContext,
} from "./setup.ts";

export const supabasePartnerPortalRepository: PartnerPortalRepository = {
  authenticateLogin: authenticateSupabasePartnerPortalLogin,
  requestPasswordReset: requestSupabasePartnerPortalPasswordReset,
  changePassword: changeSupabasePartnerPortalPassword,
  async listDemoSetups() {
    return [];
  },
  getSetupContext: getSupabasePartnerPortalSetupContext,
  completeInitialSetup: completeSupabasePartnerPortalInitialSetup,
};

export const activePartnerPortalRepository = isPartnerPortalMock
  ? mockPartnerPortalRepository
  : supabasePartnerPortalRepository;

export async function listPartnerPortalDemoSetups(): Promise<
  PartnerPortalDemoSetupSummary[]
> {
  return activePartnerPortalRepository.listDemoSetups();
}
