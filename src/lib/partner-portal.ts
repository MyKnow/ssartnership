import { PartnerPortalSetupError } from "./partner-portal-errors.ts";
export {
  PartnerPortalSetupError,
  type PartnerPortalSetupErrorCode,
} from "./partner-portal-errors.ts";

export type PartnerPortalServiceSummary = {
  id: string;
  name: string;
  location: string;
  categoryLabel: string;
  visibility: "public" | "confidential" | "private";
};

export type PartnerPortalCompanySummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
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
  demoVerificationCode?: string;
  isSetupComplete: boolean;
  isMock: boolean;
};

export type PartnerPortalSetupInput = {
  token: string;
  verificationCode: string;
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

export type PartnerPortalDemoSetupSummary = {
  token: string;
  companyName: string;
  loginId: string;
  serviceCount: number;
  demoVerificationCode?: string;
  isSetupComplete: boolean;
};

export interface PartnerPortalRepository {
  listDemoSetups(): Promise<PartnerPortalDemoSetupSummary[]>;
  getSetupContext(token: string): Promise<PartnerPortalSetupContext | null>;
  completeInitialSetup(
    input: PartnerPortalSetupInput,
  ): Promise<PartnerPortalSetupResult>;
}

class UnconfiguredPartnerPortalRepository implements PartnerPortalRepository {
  async listDemoSetups(): Promise<PartnerPortalDemoSetupSummary[]> {
    return [];
  }

  async getSetupContext(): Promise<PartnerPortalSetupContext | null> {
    return null;
  }

  async completeInitialSetup(): Promise<PartnerPortalSetupResult> {
    throw new PartnerPortalSetupError(
      "not_found",
      "제휴 포털 초기 설정 경로가 아직 연결되지 않았습니다.",
    );
  }
}

const dataSource =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE ??
  process.env.NEXT_PUBLIC_DATA_SOURCE ??
  "supabase";

export const isPartnerPortalMock = dataSource !== "supabase";

export const partnerPortalRepository: PartnerPortalRepository =
  new UnconfiguredPartnerPortalRepository();
