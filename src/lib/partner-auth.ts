import {
  isPartnerPortalMock,
  partnerPortalRepository,
  type PartnerPortalDemoSetupSummary,
  type PartnerPortalLoginResult,
  type PartnerPortalPasswordChangeResult,
  type PartnerPortalPasswordResetResult,
  type PartnerPortalCompanySummary,
  type PartnerPortalSetupContext,
  type PartnerPortalSetupInput,
  type PartnerPortalSetupResult,
} from "./partner-portal.ts";
import {
  authenticateMockPartnerPortalLogin,
  changeMockPartnerPortalPassword,
  mockPartnerPortalRepository,
  requestMockPartnerPortalPasswordReset,
} from "./mock/partner-portal.ts";
import {
  generateTempPassword,
  hashPassword,
  isValidPassword,
  verifyPassword,
} from "./password.ts";
import { normalizePartnerLoginId } from "./partner-utils.ts";
import { normalizePartnerVisibility } from "./partner-visibility.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";
import { hashCode } from "./mm-verification.ts";
import {
  PartnerPortalLoginError,
  PartnerPortalSetupError,
  type PartnerPortalSetupErrorCode,
} from "./partner-portal-errors.ts";
import {
  PartnerPortalPasswordChangeError,
  PartnerPortalPasswordResetError,
} from "./partner-password-errors.ts";

const activePartnerPortalRepository = isPartnerPortalMock
  ? mockPartnerPortalRepository
  : partnerPortalRepository;

export async function listPartnerPortalDemoSetups(): Promise<
  PartnerPortalDemoSetupSummary[]
> {
  return activePartnerPortalRepository.listDemoSetups();
}

type PartnerPortalAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_token?: string | null;
  initial_setup_verification_code_hash?: string | null;
  initial_setup_link_sent_at?: string | null;
};

type PartnerPortalSetupCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
};

type PartnerPortalSetupServiceRow = {
  id: string;
  name: string;
  location: string;
  visibility?: string | null;
  categories?:
    | { label?: string | null }
    | Array<{ label?: string | null }>
    | null;
};

function toPartnerPortalAccountSummary(
  account: PartnerPortalAccountRow,
  overrides?: Partial<PartnerPortalLoginResult["account"]>,
) {
  return {
    id: account.id,
    loginId: account.login_id,
    displayName: account.display_name,
    email: account.email ?? account.login_id,
    mustChangePassword: Boolean(account.must_change_password),
    emailVerifiedAt: account.email_verified_at ?? null,
    initialSetupCompletedAt: account.initial_setup_completed_at ?? null,
    isActive: Boolean(account.is_active),
    ...overrides,
  };
}

function extractPartnerPortalCategoryLabel(
  categories: PartnerPortalSetupServiceRow["categories"],
) {
  if (!categories) {
    return "제휴";
  }
  if (Array.isArray(categories)) {
    return categories[0]?.label ?? "제휴";
  }
  return categories.label ?? "제휴";
}

function toPartnerPortalSetupCompanySummary(
  company: PartnerPortalSetupCompanyRow,
  services: PartnerPortalSetupServiceRow[],
): PartnerPortalCompanySummary {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description ?? null,
    contactName: company.contact_name ?? null,
    contactEmail: company.contact_email ?? null,
    contactPhone: company.contact_phone ?? null,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      location: service.location,
      categoryLabel: extractPartnerPortalCategoryLabel(service.categories),
      visibility: normalizePartnerVisibility(service.visibility),
    })),
  };
}

async function getSupabasePartnerPortalCompanyIds(
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

async function getSupabasePartnerPortalSetupCompany(
  accountId: string,
): Promise<PartnerPortalCompanySummary | null> {
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
    : (companyLink?.company as PartnerPortalSetupCompanyRow | null | undefined) ??
      null;
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

async function findSupabasePartnerPortalAccount(
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

async function findSupabasePartnerPortalSetupAccount(token: string) {
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

async function authenticateSupabasePartnerPortalLogin(
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
      emailVerifiedAt: account.email_verified_at ?? null,
      initialSetupCompletedAt: account.initial_setup_completed_at ?? null,
      isActive: Boolean(account.is_active),
    },
    companyIds,
  };
}

export async function requestPartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  if (isPartnerPortalMock) {
    return requestMockPartnerPortalPasswordReset(email);
  }

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

async function getSupabasePartnerPortalSetupContext(
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
    account: {
      id: account.id,
      loginId: account.login_id,
      displayName: account.display_name,
      email: account.email ?? account.login_id,
      mustChangePassword: Boolean(account.must_change_password),
      emailVerifiedAt: account.email_verified_at ?? null,
      initialSetupCompletedAt: account.initial_setup_completed_at ?? null,
      isActive: Boolean(account.is_active),
    },
    company,
    isSetupComplete: false,
    isMock: false,
  };
}

async function completeSupabasePartnerPortalInitialSetup(
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

export async function changePartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  if (isPartnerPortalMock) {
    return changeMockPartnerPortalPassword(input);
  }

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
    account: {
      id: account.id,
      loginId: account.login_id,
      displayName: account.display_name,
      email: account.email ?? account.login_id,
      mustChangePassword: false,
      emailVerifiedAt: account.email_verified_at ?? null,
      initialSetupCompletedAt: account.initial_setup_completed_at ?? null,
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

export async function getPartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  if (isPartnerPortalMock) {
    return activePartnerPortalRepository.getSetupContext(token);
  }
  return getSupabasePartnerPortalSetupContext(token);
}

export async function completePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  if (isPartnerPortalMock) {
    return activePartnerPortalRepository.completeInitialSetup(input);
  }
  return completeSupabasePartnerPortalInitialSetup(input);
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
