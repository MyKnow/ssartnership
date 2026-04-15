import type {
  PartnerPortalLoginResult,
  PartnerPortalPasswordChangeResult,
  PartnerPortalPasswordResetResult,
  PartnerPortalSetupContext,
  PartnerPortalSetupInput,
  PartnerPortalSetupResult,
} from "../partner-portal.ts";
import {
  PartnerPortalLoginError,
  PartnerPortalSetupError,
} from "../partner-portal-errors.ts";
import {
  PartnerPortalPasswordChangeError,
  PartnerPortalPasswordResetError,
} from "../partner-password-errors.ts";
import {
  generateTempPassword,
  hashPassword,
  isValidPassword,
  verifyPassword,
} from "../password.ts";
import { normalizePartnerLoginId } from "../partner-utils.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import { hashCode } from "../mm-verification.ts";
import { toPartnerPortalAccountSummary, toPartnerPortalSetupCompanySummary } from "./mappers.ts";
import type {
  PartnerPortalAccountRow,
  PartnerPortalSetupCompanyRow,
  PartnerPortalSetupServiceRow,
} from "./types.ts";

export async function getSupabasePartnerPortalCompanyIds(
  accountId: string,
): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data: companyLinks, error } = await supabase
    .from("partner_account_companies")
    .select("company_id,is_active")
    .eq("account_id", accountId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (companyLinks ?? [])
    .map((item) => item.company_id)
    .filter((companyId): companyId is string => Boolean(companyId));
}

export async function getSupabasePartnerPortalSetupCompany(
  accountId: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data: companyLink, error: companyLinkError } = await supabase
    .from("partner_account_companies")
    .select(
      "company_id,company:partner_companies(id,name,slug,description,contact_name,contact_email,contact_phone,is_active)",
    )
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (companyLinkError) {
    throw companyLinkError;
  }

  const company = Array.isArray(companyLink?.company)
    ? (companyLink.company[0] as PartnerPortalSetupCompanyRow | undefined) ?? null
    : (companyLink?.company as PartnerPortalSetupCompanyRow | null | undefined) ?? null;
  if (!company || company.is_active === false) {
    return null;
  }

  const { data: services, error: servicesError } = await supabase
    .from("partners")
    .select("id,name,location,visibility,categories(label)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: true });

  if (servicesError) {
    throw servicesError;
  }

  return toPartnerPortalSetupCompanySummary(
    company,
    (services ?? []) as PartnerPortalSetupServiceRow[],
  );
}

export async function findSupabasePartnerPortalAccount(
  loginIdOrEmail: string,
): Promise<PartnerPortalAccountRow | null> {
  const supabase = getSupabaseAdminClient();
  const select =
    "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at";

  const { data: byLoginId, error: loginError } = await supabase
    .from("partner_accounts")
    .select(select)
    .eq("login_id", loginIdOrEmail)
    .maybeSingle();

  if (loginError) {
    throw loginError;
  }
  if (byLoginId) {
    return byLoginId as PartnerPortalAccountRow;
  }

  const { data: byEmail, error: emailError } = await supabase
    .from("partner_accounts")
    .select(select)
    .eq("email", loginIdOrEmail)
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  return (byEmail as PartnerPortalAccountRow | null) ?? null;
}

export async function findSupabasePartnerPortalSetupAccount(token: string) {
  const supabase = getSupabaseAdminClient();
  const { data: account, error } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_token,initial_setup_verification_code_hash,initial_setup_link_sent_at",
    )
    .eq("initial_setup_token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (account as PartnerPortalAccountRow | null) ?? null;
}

export async function authenticateSupabasePartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  const supabase = getSupabaseAdminClient();
  const normalizedLoginId = normalizePartnerLoginId(loginId);
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at",
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

  if (account.must_change_password && !account.initial_setup_completed_at) {
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

  const companyIds = await getSupabasePartnerPortalCompanyIds(account.id);
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
    account: toPartnerPortalAccountSummary(account),
    companyIds,
  };
}

export async function requestSupabasePartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  const normalizedEmail = normalizePartnerLoginId(email);
  const account = await findSupabasePartnerPortalAccount(normalizedEmail);
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
  const emailVerifiedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_accounts")
    .update({
      password_hash: passwordRecord.hash,
      password_salt: passwordRecord.salt,
      must_change_password: true,
      email_verified_at: emailVerifiedAt,
      updated_at: emailVerifiedAt,
    })
    .eq("id", account.id);

  if (error) {
    throw new PartnerPortalPasswordResetError(
      "send_failed",
      "임시 비밀번호 전송에 실패했습니다.",
    );
  }

  return {
    account: toPartnerPortalAccountSummary({
      ...account,
      password_hash: passwordRecord.hash,
      password_salt: passwordRecord.salt,
      must_change_password: true,
      email_verified_at: emailVerifiedAt,
    }),
    temporaryPassword,
    emailSentTo: account.email ?? account.login_id,
  };
}

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

export async function changeSupabasePartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  const supabase = getSupabaseAdminClient();
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at",
    )
    .eq("id", input.accountId)
    .maybeSingle();

  if (accountError) {
    throw accountError;
  }
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
  const { error: updateError } = await supabase
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
