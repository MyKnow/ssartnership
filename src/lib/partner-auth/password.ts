import type { PartnerPortalPasswordChangeResult } from "../partner-portal.ts";
import { PartnerPortalPasswordChangeError } from "../partner-password-errors.ts";
import { hashPassword, isValidPassword, verifyPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds } from "./company.ts";
import { getSupabasePartnerPortalAccountById } from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

export async function changeSupabasePartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  const account = await getSupabasePartnerPortalAccountById(input.accountId);
  if (!account || !account.is_active) {
    throw new PartnerPortalPasswordChangeError(
      "unauthorized",
      "로그인 후 다시 시도해 주세요.",
    );
  }
  if (
    typeof account.password_hash !== "string" ||
    typeof account.password_salt !== "string"
  ) {
    throw new PartnerPortalPasswordChangeError(
      "wrong_password",
      "현재 비밀번호가 올바르지 않습니다.",
    );
  }

  const currentPasswordOk = verifyPassword(
    input.currentPassword,
    account.password_salt,
    account.password_hash,
  );
  if (!currentPasswordOk) {
    throw new PartnerPortalPasswordChangeError(
      "wrong_password",
      "현재 비밀번호가 올바르지 않습니다.",
    );
  }

  if (!isValidPassword(input.nextPassword)) {
    throw new PartnerPortalPasswordChangeError(
      "invalid_password",
      "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
    );
  }

  const nextPasswordRecord = hashPassword(input.nextPassword);
  const now = new Date().toISOString();
  const { error: updateError } = await getSupabaseAdminClient()
    .from("partner_accounts")
    .update({
      password_hash: nextPasswordRecord.hash,
      password_salt: nextPasswordRecord.salt,
      must_change_password: false,
      updated_at: now,
    })
    .eq("id", account.id);

  if (updateError) {
    throw updateError;
  }

  const companyIds = await getSupabasePartnerPortalCompanyIds(account.id);

  return {
    account: toPartnerPortalAccountSummary({
      ...account,
      must_change_password: false,
    }),
    companyIds,
  };
}
