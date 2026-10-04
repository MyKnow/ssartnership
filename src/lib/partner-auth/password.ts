import type { PartnerPortalPasswordChangeResult } from "../partner-portal.ts";
import { PartnerPortalPasswordChangeError } from "../partner-password-errors.ts";
import { hashPassword, isValidPassword, verifyPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds } from "./company.ts";
import type { PartnerPortalAccountRow } from "./types.ts";
import {
  PARTNER_ACCOUNT_SELECT,
  getPartnerAccountAuthSessionVersion,
  getSupabasePartnerPortalAccountById,
} from "./accounts.ts";
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
  const updateQuery = getSupabaseAdminClient()
    .from("partner_accounts")
    .update({
      password_hash: nextPasswordRecord.hash,
      password_salt: nextPasswordRecord.salt,
      auth_session_version: getPartnerAccountAuthSessionVersion(account) + 1,
      must_change_password: false,
      updated_at: now,
    })
    .eq("id", account.id);

  const { data, error: updateError } = await (account.updated_at
    ? updateQuery.eq("updated_at", account.updated_at)
    : updateQuery.is("updated_at", null))
    .select(PARTNER_ACCOUNT_SELECT)
    .maybeSingle();
  const updatedAccount = data as PartnerPortalAccountRow | null;

  if (updateError) {
    throw updateError;
  }
  if (!updatedAccount?.id) {
    throw new PartnerPortalPasswordChangeError(
      "unauthorized",
      "로그인 후 다시 시도해 주세요.",
    );
  }

  const companyIds = await getSupabasePartnerPortalCompanyIds(account.id);

  return {
    account: toPartnerPortalAccountSummary(updatedAccount),
    companyIds,
  };
}
