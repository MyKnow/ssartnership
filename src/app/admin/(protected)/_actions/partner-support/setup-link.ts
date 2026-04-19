import { randomUUID } from "node:crypto";
import { SITE_URL } from "@/lib/site";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import type { AdminSupabaseClient } from "../shared-types";

export async function issuePartnerAccountInitialSetupLink(
  supabase: AdminSupabaseClient,
  accountId: string,
) {
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }
  if (!account) {
    throw new Error("초기설정 URL을 전송할 계정을 찾을 수 없습니다.");
  }
  if (!account.is_active) {
    throw new Error("비활성화된 계정입니다. 먼저 활성화해 주세요.");
  }
  if (account.initial_setup_completed_at) {
    throw new Error("이미 초기 설정이 완료된 계정입니다.");
  }

  const emailSentTo = normalizePartnerLoginId(account.email ?? account.login_id);
  if (!isValidEmail(emailSentTo)) {
    throw new Error("담당자 이메일 형식이 올바르지 않습니다.");
  }

  const setupToken = randomUUID();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("partner_accounts")
    .update({
      initial_setup_token: setupToken,
      initial_setup_verification_code_hash: null,
      initial_setup_link_sent_at: null,
      must_change_password: true,
      email_verified_at: null,
      updated_at: now,
    })
    .eq("id", account.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    account,
    emailSentTo,
    setupToken,
    setupUrl: new URL(`/partner/setup/${setupToken}`, SITE_URL).toString(),
    now,
  };
}
