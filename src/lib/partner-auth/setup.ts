import type {
  PartnerPortalSetupContext,
  PartnerPortalSetupInput,
  PartnerPortalSetupResult,
} from "../partner-portal.ts";
import { PartnerPortalSetupError } from "../partner-portal-errors.ts";
import { hashPassword, isValidPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds, getSupabasePartnerPortalSetupCompany } from "./company.ts";
import { findSupabasePartnerPortalSetupAccount } from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

const INITIAL_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PartnerSetupCompletionCommonPayload = {
  password_hash: string;
  password_salt: string;
  must_change_password: boolean;
  is_active: boolean;
  email_verified_at: string;
  initial_setup_completed_at: string;
  updated_at: string;
};

type PartnerSetupCompletionPayloadCandidate = {
  label: string;
  payload: ReturnType<typeof buildPartnerSetupCompletionPayload>;
};

function buildPartnerSetupCompletionPayload(
  commonPayload: PartnerSetupCompletionCommonPayload,
  options: {
    supportsPlainToken: boolean;
    supportsHash: boolean;
    supportsExpiry: boolean;
  },
) {
  return {
    ...commonPayload,
    ...(options.supportsPlainToken ? { initial_setup_token: null } : {}),
    ...(options.supportsHash ? { initial_setup_token_hash: null } : {}),
    ...(options.supportsExpiry ? { initial_setup_expires_at: null } : {}),
  };
}

function isMissingSchemaColumn(errorMessage: string, columnName: string) {
  return errorMessage.includes(`'${columnName}'`);
}

export function resolvePartnerSetupCompletionFallbackPayload(
  commonPayload: PartnerSetupCompletionCommonPayload,
  errorMessage: string,
) {
  return buildPartnerSetupCompletionPayload(commonPayload, {
    supportsPlainToken: !isMissingSchemaColumn(errorMessage, "initial_setup_token"),
    supportsHash: !isMissingSchemaColumn(errorMessage, "initial_setup_token_hash"),
    supportsExpiry: !isMissingSchemaColumn(errorMessage, "initial_setup_expires_at"),
  });
}

function isMissingPartnerSetupSchemaColumnError(errorMessage: string) {
  return (
    isMissingSchemaColumn(errorMessage, "initial_setup_token") ||
    isMissingSchemaColumn(errorMessage, "initial_setup_token_hash") ||
    isMissingSchemaColumn(errorMessage, "initial_setup_expires_at")
  );
}

function buildPartnerSetupCompletionPayloadCandidates(
  commonPayload: PartnerSetupCompletionCommonPayload,
  account: {
    initial_setup_token?: string | null;
    initial_setup_token_hash?: string | null;
    initial_setup_expires_at?: string | null;
  },
) : PartnerSetupCompletionPayloadCandidate[] {
  const supportsPlainToken = "initial_setup_token" in account;
  const supportsHash = "initial_setup_token_hash" in account;
  const supportsExpiry = "initial_setup_expires_at" in account;

  return [
    {
      label: "detected",
      payload: buildPartnerSetupCompletionPayload(commonPayload, {
        supportsPlainToken,
        supportsHash,
        supportsExpiry,
      }),
    },
    {
      label: "no-expiry",
      payload: buildPartnerSetupCompletionPayload(commonPayload, {
        supportsPlainToken,
        supportsHash,
        supportsExpiry: false,
      }),
    },
    {
      label: "no-hash",
      payload: buildPartnerSetupCompletionPayload(commonPayload, {
        supportsPlainToken,
        supportsHash: false,
        supportsExpiry,
      }),
    },
    {
      label: "legacy",
      payload: buildPartnerSetupCompletionPayload(commonPayload, {
        supportsPlainToken: false,
        supportsHash: false,
        supportsExpiry: false,
      }),
    },
  ];
}

function maskPartnerSetupToken(token: string) {
  if (token.length <= 12) {
    return token;
  }

  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function resolveSetupExpiry(account: {
  initial_setup_expires_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  updated_at?: string | null;
}) {
  if (account.initial_setup_expires_at) {
    return account.initial_setup_expires_at;
  }

  const fallbackBase = account.initial_setup_link_sent_at ?? account.updated_at ?? null;
  if (!fallbackBase) {
    return null;
  }

  return new Date(new Date(fallbackBase).getTime() + INITIAL_SETUP_TTL_MS).toISOString();
}

function hasSetupToken(account: {
  initial_setup_token?: string | null;
  initial_setup_token_hash?: string | null;
}) {
  return Boolean(account.initial_setup_token_hash || account.initial_setup_token);
}

export async function getSupabasePartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  const account = await findSupabasePartnerPortalSetupAccount(token);
  const expiresAt = account ? resolveSetupExpiry(account) : null;
  if (
    !account ||
    !account.is_active ||
    !hasSetupToken(account) ||
    !expiresAt ||
    new Date(expiresAt).getTime() <= Date.now() ||
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
    isSetupComplete: Boolean(account.initial_setup_completed_at),
    isMock: false,
  };
}

export async function completeSupabasePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  const account = await findSupabasePartnerPortalSetupAccount(input.token);
  const expiresAt = account ? resolveSetupExpiry(account) : null;

  if (!account || !hasSetupToken(account)) {
    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
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
  const basePayload = {
    password_hash: passwordRecord.hash,
    password_salt: passwordRecord.salt,
    must_change_password: false,
    is_active: true,
    email_verified_at: completedAt,
    initial_setup_completed_at: completedAt,
    updated_at: completedAt,
  };
  const payloadCandidates = buildPartnerSetupCompletionPayloadCandidates(basePayload, account);
  let lastSchemaError: Error | null = null;

  for (const candidate of payloadCandidates) {
    const attempt = await supabase
      .from("partner_accounts")
      .update(candidate.payload)
      .eq("id", account.id);

    if (!attempt.error) {
      lastSchemaError = null;
      break;
    }

    console.error("[partner-setup] completion update failed", {
      accountId: account.id,
      token: maskPartnerSetupToken(input.token),
      candidate: candidate.label,
      errorMessage: attempt.error.message,
      errorCode: "code" in attempt.error ? attempt.error.code : undefined,
      errorDetails: "details" in attempt.error ? attempt.error.details : undefined,
      errorHint: "hint" in attempt.error ? attempt.error.hint : undefined,
    });

    if (!isMissingPartnerSetupSchemaColumnError(attempt.error.message)) {
      throw attempt.error;
    }

    lastSchemaError = attempt.error;
  }

  if (lastSchemaError) {
    throw lastSchemaError;
  }

  return {
    token: input.token,
    accountId: account.id,
    companyId: companyIds[0],
    loginId: account.login_id,
    completedAt,
  };
}
