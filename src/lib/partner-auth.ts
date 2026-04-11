import {
  isPartnerPortalMock,
  partnerPortalRepository,
  type PartnerPortalDemoSetupSummary,
  type PartnerPortalLoginResult,
  type PartnerPortalSetupContext,
  type PartnerPortalSetupInput,
  type PartnerPortalSetupResult,
} from "./partner-portal.ts";
import {
  authenticateMockPartnerPortalLogin,
  mockPartnerPortalRepository,
} from "./mock/partner-portal.ts";
import { verifyPassword } from "./password.ts";
import { normalizePartnerLoginId } from "./partner-utils.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";
import {
  PartnerPortalLoginError,
  PartnerPortalSetupError,
  type PartnerPortalSetupErrorCode,
} from "./partner-portal-errors.ts";

const activePartnerPortalRepository = isPartnerPortalMock
  ? mockPartnerPortalRepository
  : partnerPortalRepository;

export async function listPartnerPortalDemoSetups(): Promise<
  PartnerPortalDemoSetupSummary[]
> {
  return activePartnerPortalRepository.listDemoSetups();
}

export async function getPartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  return activePartnerPortalRepository.getSetupContext(token);
}

export async function completePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  return activePartnerPortalRepository.completeInitialSetup(input);
}

async function authenticateSupabasePartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  const supabase = getSupabaseAdminClient();
  const normalizedLoginId = normalizePartnerLoginId(loginId);
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active",
    )
    .eq("login_id", normalizedLoginId)
    .maybeSingle();

  if (accountError) {
    throw accountError;
  }

  if (!account) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  if (!account.is_active) {
    throw new PartnerPortalLoginError(
      "inactive_account",
      "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    );
  }

  if (account.must_change_password) {
    throw new PartnerPortalLoginError(
      "setup_required",
      "초기 설정이 필요합니다. 받은 링크로 먼저 비밀번호를 설정해 주세요.",
    );
  }

  if (
    typeof account.password_hash !== "string" ||
    typeof account.password_salt !== "string"
  ) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  const ok = verifyPassword(
    password,
    account.password_salt,
    account.password_hash,
  );
  if (!ok) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  const { data: companyLinks, error: linkError } = await supabase
    .from("partner_account_companies")
    .select("company_id,is_active")
    .eq("account_id", account.id)
    .eq("is_active", true);

  if (linkError) {
    throw linkError;
  }

  const companyIds = (companyLinks ?? [])
    .map((item) => item.company_id)
    .filter((companyId): companyId is string => Boolean(companyId));

  if (companyIds.length === 0) {
    throw new PartnerPortalLoginError(
      "not_linked",
      "해당 계정에 연결된 업체가 없습니다. 관리자에게 문의해 주세요.",
    );
  }

  await supabase
    .from("partner_accounts")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", account.id);

  return {
    account: {
      id: account.id,
      loginId: account.login_id,
      displayName: account.display_name,
      email: account.email ?? account.login_id,
      mustChangePassword: Boolean(account.must_change_password),
      emailVerifiedAt: null,
      initialSetupCompletedAt: null,
      isActive: Boolean(account.is_active),
    },
    companyIds,
  };
}

export async function authenticatePartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  if (isPartnerPortalMock) {
    return authenticateMockPartnerPortalLogin(loginId, password);
  }
  return authenticateSupabasePartnerPortalLogin(loginId, password);
}

export function isPartnerPortalSetupError(
  error: unknown,
): error is PartnerPortalSetupError {
  return error instanceof PartnerPortalSetupError;
}

export function getPartnerPortalSetupErrorStatus(
  code: PartnerPortalSetupErrorCode,
) {
  switch (code) {
    case "not_found":
      return 404;
    case "already_completed":
      return 409;
    case "invalid_code":
    case "invalid_password":
    case "password_mismatch":
      return 400;
    default:
      return 400;
  }
}

export { getPartnerPortalSetupErrorMessage } from "./partner-portal-errors.ts";
export {
  PartnerPortalLoginError,
  type PartnerPortalLoginErrorCode,
  getPartnerPortalLoginErrorMessage,
  getPartnerPortalLoginErrorStatus,
} from "./partner-portal-errors.ts";
