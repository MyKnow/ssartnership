import type { PartnerPortalLoginResult } from "../partner-portal.ts";
import { PartnerPortalLoginError } from "../partner-portal-errors.ts";
import { verifyPassword } from "../password.ts";
import { toPartnerPortalAccountSummary } from "./mappers.ts";
import { getSupabasePartnerPortalCompanyIds } from "./company.ts";
import { normalizeSupabasePartnerLoginId } from "./accounts.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

export async function authenticateSupabasePartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  const normalizedLoginId = normalizeSupabasePartnerLoginId(loginId);
  const supabase = getSupabaseAdminClient();
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

  await getSupabaseAdminClient()
    .from("partner_accounts")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", account.id);

  return {
    account: toPartnerPortalAccountSummary(account),
    companyIds,
  };
}
