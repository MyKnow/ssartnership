import {
  createUnavailableDataAccessProxy,
  selectRuntimeDataAccess,
} from "./runtime-data-access.ts";

export {
  PartnerPortalSetupError,
  type PartnerPortalSetupErrorCode,
} from "./partner-portal-errors.ts";

export type PartnerPortalServiceSummary = {
  id: string;
  name: string;
  location: string;
  categoryLabel: string;
  branchScopeType?: string | null;
  visibility: "public" | "confidential" | "private";
};

export type PartnerPortalCompanySummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  services: PartnerPortalServiceSummary[];
};

export type PartnerPortalAccountSummary = {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  mustChangePassword: boolean;
  emailVerifiedAt: string | null;
  initialSetupCompletedAt: string | null;
  isActive: boolean;
};

export type PartnerPortalLoginResult = {
  account: PartnerPortalAccountSummary;
  companyIds: string[];
};

export type PartnerPortalPasswordResetResult = {
  account: PartnerPortalAccountSummary;
  temporaryPassword: string;
  emailSentTo: string;
};

export type PartnerPortalPasswordChangeResult = PartnerPortalLoginResult;

export type PartnerPortalSetupContext = {
  token: string;
  account: PartnerPortalAccountSummary;
  company: PartnerPortalCompanySummary;
  isSetupComplete: boolean;
  isMock: boolean;
};

export type PartnerPortalSetupInput = {
  token: string;
  password: string;
  confirmPassword: string;
};

export type PartnerPortalSetupResult = {
  token: string;
  accountId: string;
  companyId: string;
  loginId: string;
  completedAt: string;
};

export type PartnerPortalSetupLinkResult = {
  account: PartnerPortalAccountSummary;
  setupUrl: string;
  emailSentTo: string;
};

export type PartnerPortalDemoSetupSummary = {
  token: string;
  companyName: string;
  loginId: string;
  serviceCount: number;
  isSetupComplete: boolean;
};

export interface PartnerPortalRepository {
  authenticateLogin(
    loginId: string,
    password: string,
  ): Promise<PartnerPortalLoginResult>;
  requestPasswordReset(email: string): Promise<PartnerPortalPasswordResetResult>;
  changePassword(input: {
    accountId: string;
    currentPassword: string;
    nextPassword: string;
  }): Promise<PartnerPortalPasswordChangeResult>;
  listDemoSetups(): Promise<PartnerPortalDemoSetupSummary[]>;
  getSetupContext(token: string): Promise<PartnerPortalSetupContext | null>;
  completeInitialSetup(
    input: PartnerPortalSetupInput,
  ): Promise<PartnerPortalSetupResult>;
}

export const partnerPortalDataAccess = selectRuntimeDataAccess({
  capability: "admin",
  sourcePreference: "partner-portal",
});

export const isPartnerPortalMock = partnerPortalDataAccess.source === "mock";

export function createUnavailablePartnerPortalRepository() {
  return createUnavailableDataAccessProxy<PartnerPortalRepository>(
    partnerPortalDataAccess,
    "파트너 포털 저장소를 사용할 수 없습니다.",
  );
}
