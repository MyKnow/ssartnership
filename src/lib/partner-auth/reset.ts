import type { PartnerPortalPasswordResetResult } from "../partner-portal.ts";
import { PartnerPortalPasswordResetError } from "../partner-password-errors.ts";
import { generateTempPassword, hashPassword } from "../password.ts";
import { sendPartnerPortalTemporaryPasswordEmail } from "../partner-email.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import {
  findSupabasePartnerPortalAccount,
  isMissingPartnerAuthSessionVersionColumnError,
  normalizeSupabasePartnerLoginId,
  omitPartnerAuthSessionVersion,
} from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

type PreparedPartnerPortalPasswordReset = PartnerPortalPasswordResetResult & {
  passwordRecord: ReturnType<typeof hashPassword>;
  previousAccountState: {
    passwordHash: string | null;
    passwordSalt: string | null;
    authSessionVersion: number;
    mustChangePassword: boolean;
    emailVerifiedAt: string | null;
    updatedAt: string | null;
  };
};

type CommittedPartnerPortalPasswordReset = PreparedPartnerPortalPasswordReset & {
  committedAt: string;
  committedAuthSessionVersion: number;
  usedAuthSessionVersion: boolean;
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
    previousAccountState: {
      passwordHash: account.password_hash ?? null,
      passwordSalt: account.password_salt ?? null,
      authSessionVersion: Math.max(1, Number(account.auth_session_version ?? 1)),
      mustChangePassword: Boolean(account.must_change_password),
      emailVerifiedAt: account.email_verified_at ?? null,
      updatedAt: account.updated_at ?? null,
    },
    temporaryPassword,
    emailSentTo: account.email ?? account.login_id,
  };
}

export async function commitSupabasePartnerPortalPasswordReset(
  reset: PreparedPartnerPortalPasswordReset,
): Promise<CommittedPartnerPortalPasswordReset> {
  const committedAt = new Date().toISOString();
  const committedAuthSessionVersion =
    reset.previousAccountState.authSessionVersion + 1;
  const supabase = getSupabaseAdminClient();
  const payloadWithVersion = {
    password_hash: reset.passwordRecord.hash,
    password_salt: reset.passwordRecord.salt,
    auth_session_version: committedAuthSessionVersion,
    must_change_password: true,
    email_verified_at: committedAt,
    updated_at: committedAt,
  };
  const attemptCommit = async (payload: Record<string, unknown>) => {
    const commitQuery = supabase
      .from("partner_accounts")
      .update(payload)
      .eq("id", reset.account.id);

    return (reset.previousAccountState.updatedAt
      ? commitQuery.eq("updated_at", reset.previousAccountState.updatedAt)
      : commitQuery.is("updated_at", null))
      .select("id")
      .maybeSingle();
  };

  let usedAuthSessionVersion = true;
  let { data, error } = await attemptCommit(payloadWithVersion);

  if (
    error &&
    isMissingPartnerAuthSessionVersionColumnError(error.message)
  ) {
    usedAuthSessionVersion = false;
    ({ data, error } = await attemptCommit(
      omitPartnerAuthSessionVersion(payloadWithVersion),
    ));
  }

  if (error || !data?.id) {
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
      email_verified_at: committedAt,
      initial_setup_completed_at: reset.account.initialSetupCompletedAt,
      is_active: reset.account.isActive,
    }),
    passwordRecord: reset.passwordRecord,
    previousAccountState: reset.previousAccountState,
    temporaryPassword: reset.temporaryPassword,
    emailSentTo: reset.emailSentTo,
    committedAt,
    committedAuthSessionVersion,
    usedAuthSessionVersion,
  };
}

export async function rollbackSupabasePartnerPortalPasswordReset(
  reset: CommittedPartnerPortalPasswordReset,
) {
  const supabase = getSupabaseAdminClient();
  const rollbackAt = new Date().toISOString();
  const rollbackQuery = supabase
    .from("partner_accounts")
    .update(
      reset.usedAuthSessionVersion
        ? {
            password_hash: reset.previousAccountState.passwordHash,
            password_salt: reset.previousAccountState.passwordSalt,
            auth_session_version: reset.previousAccountState.authSessionVersion,
            must_change_password: reset.previousAccountState.mustChangePassword,
            email_verified_at: reset.previousAccountState.emailVerifiedAt,
            updated_at: rollbackAt,
          }
        : {
            password_hash: reset.previousAccountState.passwordHash,
            password_salt: reset.previousAccountState.passwordSalt,
            must_change_password: reset.previousAccountState.mustChangePassword,
            email_verified_at: reset.previousAccountState.emailVerifiedAt,
            updated_at: rollbackAt,
          },
    )
    .eq("id", reset.account.id)
    .eq("password_hash", reset.passwordRecord.hash)
    .eq("password_salt", reset.passwordRecord.salt)
    .eq("updated_at", reset.committedAt);
  const guardedRollbackQuery = reset.usedAuthSessionVersion
    ? rollbackQuery.eq("auth_session_version", reset.committedAuthSessionVersion)
    : rollbackQuery;

  const { data, error } = await guardedRollbackQuery.select("id").maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

async function deliverCommittedPartnerPortalPasswordReset(
  reset: CommittedPartnerPortalPasswordReset,
) {
  try {
    await sendPartnerPortalTemporaryPasswordEmail({
      to: reset.emailSentTo,
      displayName: reset.account.displayName,
      loginId: reset.account.loginId,
      temporaryPassword: reset.temporaryPassword,
    });
  } catch (deliveryError) {
    let rollbackSucceeded = false;
    try {
      rollbackSucceeded =
        await rollbackSupabasePartnerPortalPasswordReset(reset);
    } catch (rollbackError) {
      console.error("[partner-reset] temporary password rollback failed", {
        accountId: reset.account.id,
        message:
          rollbackError instanceof Error
            ? rollbackError.message
            : "unknown_rollback_error",
      });
    }

    console.error("[partner-reset] temporary password delivery failed", {
      accountId: reset.account.id,
      rollbackSucceeded,
      message:
        deliveryError instanceof Error
          ? deliveryError.message
          : "unknown_delivery_error",
    });
    throw new PartnerPortalPasswordResetError(
      "send_failed",
      "임시 비밀번호 전송에 실패했습니다.",
    );
  }

  return reset;
}

export async function requestSupabasePartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  const reset = await prepareSupabasePartnerPortalPasswordReset(email);
  const committedReset = await commitSupabasePartnerPortalPasswordReset(reset);
  return deliverCommittedPartnerPortalPasswordReset(committedReset);
}
