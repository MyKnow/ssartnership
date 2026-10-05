import "server-only";
import type { PreviousMemberEmailState } from "@/lib/member-email-change-notice";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function readMemberPasswordRecord(memberId: string): Promise<{ hash: string; salt: string } | null> {
  const { data, error } = await getSupabaseAdminClient().from("members")
    .select("password_hash,password_salt").eq("id", memberId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("MEMBER_PASSWORD_READ_FAILED");
  return data?.password_hash && data.password_salt
    ? { hash: data.password_hash, salt: data.password_salt } : null;
}

export async function readMemberEmailNoticeState(memberId: string): Promise<PreviousMemberEmailState | null> {
  const { data, error } = await getSupabaseAdminClient().from("members")
    .select("email_normalized,email_verified_at,display_name").eq("id", memberId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("MEMBER_EMAIL_NOTICE_READ_FAILED");
  return data ? {
    emailNormalized: data.email_normalized ?? null,
    emailVerifiedAt: data.email_verified_at ?? null,
    displayName: data.display_name ?? null,
  } : null;
}
