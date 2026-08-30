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

const dataSource =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE ??
  process.env.NEXT_PUBLIC_DATA_SOURCE ??
  "supabase";

export const isPartnerPortalMock = dataSource !== "supabase";
