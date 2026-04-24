import type { PartnerPortalPasswordResetResult } from "../partner-portal.ts";
import { PartnerPortalPasswordResetError } from "../partner-password-errors.ts";
import { generateTempPassword, hashPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import {
  findSupabasePartnerPortalAccount,
  normalizeSupabasePartnerLoginId,
} from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

type PreparedPartnerPortalPasswordReset = PartnerPortalPasswordResetResult & {
  passwordRecord: ReturnType<typeof hashPassword>;
};

export async function prepareSupabasePartnerPortalPasswordReset(
  email: string,
): Promise<PreparedPartnerPortalPasswordReset> {
  const account = await findSupabasePartnerPortalAccount(
    normalizeSupabasePartnerLoginId(email),
  );
  if (!account) {
    throw new PartnerPortalPasswordResetError(
      "not_found",
      "해당 이메일로 등록된 계정을 찾을 수 없습니다.",
    );
  }
  if (!account.is_active) {
    throw new PartnerPortalPasswordResetError(
      "inactive_account",
      "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    );
  }
  if (!account.initial_setup_completed_at) {
    throw new PartnerPortalPasswordResetError(
      "setup_required",
      "아직 초기 설정이 완료되지 않았습니다. 초기 설정 링크를 먼저 사용해 주세요.",
    );
  }

  const temporaryPassword = generateTempPassword(12);
  const passwordRecord = hashPassword(temporaryPassword);

  return {
    account: toPartnerPortalAccountSummary(account),
    passwordRecord,
    temporaryPassword,
    emailSentTo: account.email ?? account.login_id,
  };
}

export async function commitSupabasePartnerPortalPasswordReset(
  reset: PreparedPartnerPortalPasswordReset,
): Promise<PartnerPortalPasswordResetResult> {
  const emailVerifiedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_accounts")
    .update({
      password_hash: reset.passwordRecord.hash,
      password_salt: reset.passwordRecord.salt,
      must_change_password: true,
      email_verified_at: emailVerifiedAt,
      updated_at: emailVerifiedAt,
    })
    .eq("id", reset.account.id);

  if (error) {
    throw new PartnerPortalPasswordResetError(
      "send_failed",
      "임시 비밀번호 전송에 실패했습니다.",
    );
  }

  return {
    account: toPartnerPortalAccountSummary({
      id: reset.account.id,
      login_id: reset.account.loginId,
      display_name: reset.account.displayName,
      email: reset.account.email,
      password_hash: reset.passwordRecord.hash,
      password_salt: reset.passwordRecord.salt,
      must_change_password: true,
      email_verified_at: emailVerifiedAt,
      initial_setup_completed_at: reset.account.initialSetupCompletedAt,
      is_active: reset.account.isActive,
    }),
    temporaryPassword: reset.temporaryPassword,
    emailSentTo: reset.emailSentTo,
  };
}

export async function requestSupabasePartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  const reset = await prepareSupabasePartnerPortalPasswordReset(email);
  return commitSupabasePartnerPortalPasswordReset(reset);
}
