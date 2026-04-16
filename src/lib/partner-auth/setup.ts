import type {
  PartnerPortalSetupContext,
  PartnerPortalSetupInput,
  PartnerPortalSetupResult,
} from "../partner-portal.ts";
import { PartnerPortalSetupError } from "../partner-portal-errors.ts";
import { hashPassword, isValidPassword } from "../password.ts";
import { hashCode } from "../mm-verification.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds, getSupabasePartnerPortalSetupCompany } from "./company.ts";
import { findSupabasePartnerPortalSetupAccount } from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

export async function getSupabasePartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  const account = await findSupabasePartnerPortalSetupAccount(token);
  if (
    !account ||
    !account.is_active ||
    !account.initial_setup_token ||
    account.initial_setup_completed_at
  ) {
    return null;
  }

  const company = await getSupabasePartnerPortalSetupCompany(account.id);
  if (!company) {
    return null;
  }

  return {
    token,
    account: toPartnerPortalAccountSummary(account),
    company,
    isSetupComplete: false,
    isMock: false,
  };
}

export async function completeSupabasePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  const account = await findSupabasePartnerPortalSetupAccount(input.token);

  if (!account || !account.initial_setup_token) {
    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }
  if (account.initial_setup_completed_at) {
    throw new PartnerPortalSetupError(
      "already_completed",
      "이미 초기 설정이 완료되었습니다.",
    );
  }
  if (!account.initial_setup_verification_code_hash) {
    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }
  if (hashCode(input.verificationCode.trim()) !== account.initial_setup_verification_code_hash) {
    throw new PartnerPortalSetupError(
      "invalid_code",
      "이메일 인증 코드가 올바르지 않습니다.",
    );
  }

  if (input.password !== input.confirmPassword) {
    throw new PartnerPortalSetupError(
      "password_mismatch",
      "비밀번호 확인이 일치하지 않습니다.",
    );
  }

  if (!isValidPassword(input.password)) {
    throw new PartnerPortalSetupError(
      "invalid_password",
      "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
    );
  }

  const passwordRecord = hashPassword(input.password);
  const completedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const companyIds = await getSupabasePartnerPortalCompanyIds(account.id);
  if (companyIds.length === 0) {
    throw new PartnerPortalSetupError(
      "not_found",
      "연결된 협력사를 찾을 수 없습니다.",
    );
  }
  const { error } = await supabase
    .from("partner_accounts")
    .update({
      password_hash: passwordRecord.hash,
      password_salt: passwordRecord.salt,
      must_change_password: false,
      is_active: true,
      email_verified_at: completedAt,
      initial_setup_completed_at: completedAt,
      initial_setup_token: null,
      initial_setup_verification_code_hash: null,
      updated_at: completedAt,
    })
    .eq("id", account.id);

  if (error) {
    throw error;
  }

  return {
    token: input.token,
    accountId: account.id,
    companyId: companyIds[0],
    loginId: account.login_id,
    completedAt,
  };
}
