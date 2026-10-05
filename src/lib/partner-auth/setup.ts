import type {
  PartnerPortalSetupContext,
  PartnerPortalSetupInput,
  PartnerPortalSetupResult,
} from "./portal.ts";
import { PartnerPortalSetupError } from "./portal-errors.ts";
import { hashPassword, isValidPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds, getSupabasePartnerPortalSetupCompany } from "./company.ts";
import {
  findSupabasePartnerPortalSetupAccount,
  getPartnerAccountAuthSessionVersion,
  getSupabasePartnerPortalAccountById,
} from "./accounts.ts";
import type { PartnerPortalAccountRow } from "./types.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import { getPartnerSetupLinkState } from "./setup-link.ts";

function maskPartnerSetupToken(token: string) {
  if (token.length <= 12) {
    return token;
  }

  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function getAccountSetupLinkState(account: PartnerPortalAccountRow) {
  return getPartnerSetupLinkState({
    isActive: account.is_active === true,
    hasToken: Boolean(account.initial_setup_token_hash),
    expiresAt: account.initial_setup_expires_at ?? null,
    completedAt: account.initial_setup_completed_at ?? null,
  });
}

/**
 * Completion clears the single-use token hash and its expiry in the same
 * compare-and-swap update that stores the password, so a link can never be
 * replayed after a successful setup.
 */
export function buildPartnerSetupCompletionPayload(input: {
  passwordHash: string;
  passwordSalt: string;
  authSessionVersion: number;
  completedAt: string;
}) {
  return {
    password_hash: input.passwordHash,
    password_salt: input.passwordSalt,
    auth_session_version: input.authSessionVersion,
    must_change_password: false,
    is_active: true,
    email_verified_at: input.completedAt,
    initial_setup_completed_at: input.completedAt,
    initial_setup_token_hash: null,
    initial_setup_expires_at: null,
    updated_at: input.completedAt,
  };
}

export async function getSupabasePartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  const account = await findSupabasePartnerPortalSetupAccount(token);
  if (!account || getAccountSetupLinkState(account) !== "usable") {
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
    isSetupComplete: Boolean(account.initial_setup_completed_at),
    isMock: false,
  };
}

export async function completeSupabasePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  const account = await findSupabasePartnerPortalSetupAccount(input.token);
  const linkState = account ? getAccountSetupLinkState(account) : null;

  if (
    !account ||
    !account.initial_setup_token_hash ||
    linkState === "inactive" ||
    linkState === "missing_token" ||
    linkState === "expired"
  ) {
    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }
  if (linkState === "completed") {
    throw new PartnerPortalSetupError(
      "already_completed",
      "이미 초기 설정이 완료되었습니다.",
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
  const companyIds = await getSupabasePartnerPortalCompanyIds(account.id);
  if (companyIds.length === 0) {
    throw new PartnerPortalSetupError(
      "not_found",
      "연결된 파트너사를 찾을 수 없습니다.",
    );
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("partner_accounts")
    .update(
      buildPartnerSetupCompletionPayload({
        passwordHash: passwordRecord.hash,
        passwordSalt: passwordRecord.salt,
        authSessionVersion: getPartnerAccountAuthSessionVersion(account) + 1,
        completedAt,
      }),
    )
    .eq("id", account.id)
    .is("initial_setup_completed_at", null)
    .eq("initial_setup_token_hash", account.initial_setup_token_hash)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[partner-setup] completion update failed", {
      accountId: account.id,
      token: maskPartnerSetupToken(input.token),
      errorMessage: error.message,
      errorCode: "code" in error ? error.code : undefined,
    });
    throw error;
  }

  if (!data?.id) {
    const latestAccount = await getSupabasePartnerPortalAccountById(account.id);
    if (latestAccount?.initial_setup_completed_at) {
      throw new PartnerPortalSetupError(
        "already_completed",
        "이미 초기 설정이 완료되었습니다.",
      );
    }

    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }

  return {
    token: input.token,
    accountId: account.id,
    companyId: companyIds[0],
    loginId: account.login_id,
    completedAt,
  };
}
