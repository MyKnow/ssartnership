import { SITE_URL } from "@/lib/site";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import type { AdminSupabaseClient } from "../shared-types";
import {
  buildPartnerSetupIssuePayload,
  resolvePartnerSetupSchemaCapabilitiesFromError,
} from "@/lib/partner-auth/setup-schema";

const INITIAL_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function updateInitialSetupState(
  supabase: AdminSupabaseClient,
  accountId: string,
  now: string,
  setupToken: string,
  setupTokenHash: string,
) {
  const expiresAt = new Date(Date.now() + INITIAL_SETUP_TTL_MS).toISOString();
  const basePayload = {
    initial_setup_link_sent_at: null,
    must_change_password: true,
    email_verified_at: null,
    updated_at: now,
  };

  const primaryPayload = buildPartnerSetupIssuePayload(
    basePayload,
    { setupToken, setupTokenHash, expiresAt },
    {
      supportsPlainToken: false,
      supportsHash: true,
      supportsExpiry: true,
    },
  );

  const withExpires = await supabase
    .from("partner_accounts")
    .update(primaryPayload)
    .eq("id", accountId);

  if (!withExpires.error) {
    return { expiresAt };
  }

  const fallbackCapabilities = resolvePartnerSetupSchemaCapabilitiesFromError(
    withExpires.error.message,
  );

  if (fallbackCapabilities.supportsExpiry && fallbackCapabilities.supportsHash) {
    throw new Error(withExpires.error.message);
  }

  const fallbackPayload = buildPartnerSetupIssuePayload(
    basePayload,
    { setupToken, setupTokenHash, expiresAt },
    fallbackCapabilities,
  );
  const fallback = await supabase
    .from("partner_accounts")
    .update(fallbackPayload)
    .eq("id", accountId);

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return { expiresAt };
}

export async function issuePartnerAccountInitialSetupLink(
  supabase: AdminSupabaseClient,
  accountId: string,
) {
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,updated_at",
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

  const setupToken = generateOpaqueToken();
  const setupTokenHash = hashOpaqueToken(setupToken);
  const now = new Date().toISOString();
  const { expiresAt } = await updateInitialSetupState(
    supabase,
    account.id,
    now,
    setupToken,
    setupTokenHash,
  );

  return {
    account,
    emailSentTo,
    setupUrl: new URL(`/partner/setup/${setupToken}`, SITE_URL).toString(),
    now,
    expiresAt,
  };
}
