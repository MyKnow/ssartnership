import type { PartnerPortalPasswordChangeResult } from "../partner-portal.ts";
import { PartnerPortalPasswordChangeError } from "../partner-password-errors.ts";
import { hashPassword, isValidPassword, verifyPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds } from "./company.ts";
import type { PartnerPortalAccountRow } from "./types.ts";
import {
  getSupabasePartnerPortalAccountById,
  isMissingPartnerAuthSessionVersionColumnError,
} from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

function omitPartnerAuthSessionVersion<T extends Record<string, unknown>>(payload: T) {
  const nextPayload = { ...payload };
  delete nextPayload.auth_session_version;
  return nextPayload;
}

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
  const payloadWithVersion = {
    password_hash: nextPasswordRecord.hash,
    password_salt: nextPasswordRecord.salt,
    auth_session_version: Math.max(1, Number(account.auth_session_version ?? 1)) + 1,
    must_change_password: false,
    updated_at: now,
  };
  const selectWithoutVersion =
    "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,updated_at";
  const selectWithVersion = `${selectWithoutVersion},auth_session_version`;
  const attemptUpdate = async (payload: Record<string, unknown>, select: string) => {
    const updateQuery = getSupabaseAdminClient()
      .from("partner_accounts")
      .update(payload)
      .eq("id", account.id);

    const response = await (account.updated_at
      ? updateQuery.eq("updated_at", account.updated_at)
      : updateQuery.is("updated_at", null))
      .select(select)
      .maybeSingle();

    return response as {
      data: PartnerPortalAccountRow | null;
      error: { message: string } | null;
    };
  };

  let { data: updatedAccount, error: updateError } = await attemptUpdate(
    payloadWithVersion,
    selectWithVersion,
  );

  if (
    updateError &&
    isMissingPartnerAuthSessionVersionColumnError(updateError.message)
  ) {
    ({ data: updatedAccount, error: updateError } = await attemptUpdate(
      omitPartnerAuthSessionVersion(payloadWithVersion),
      selectWithoutVersion,
    ));
  }

  if (updateError || !updatedAccount?.id) {
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
