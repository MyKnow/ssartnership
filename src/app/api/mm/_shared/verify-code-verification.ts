import { hashCode } from "@/lib/mm-verification";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;

type VerificationAttemptRow = {
  id?: string | null;
  count?: number | null;
  blocked_until?: string | null;
  first_attempt_at?: string | null;
};

type VerificationCodeRow = {
  code_hash: string;
  expires_at: string;
  year: number | null;
};

export async function getVerificationAttempt(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("mm_verification_attempts")
    .select("id,count,blocked_until,first_attempt_at")
    .eq("identifier", mmUserId)
    .maybeSingle();

  return (data as VerificationAttemptRow | null) ?? null;
}

export function isVerificationAttemptBlocked(
  attempt: VerificationAttemptRow | null,
) {
  if (!attempt?.blocked_until) {
    return false;
  }
  return new Date(attempt.blocked_until) > new Date();
}

export async function getLatestVerificationCode(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("mm_verification_codes")
    .select("*")
    .eq("mm_user_id", mmUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as VerificationCodeRow | null) ?? null;
}

export function isVerificationCodeExpired(
  codeRow: VerificationCodeRow | null,
) {
  if (!codeRow) {
    return false;
  }
  return new Date(codeRow.expires_at) < new Date();
}

export async function recordInvalidVerificationCodeAttempt(
  mmUserId: string,
  attempt: VerificationAttemptRow | null,
  code: string,
  codeRow: VerificationCodeRow,
) {
  if (codeRow.code_hash === hashCode(code)) {
    return { matched: true as const, blockedUntil: null, nextCount: 0 };
  }

  const supabase = getSupabaseAdminClient();
  const nextCount = (attempt?.count ?? 0) + 1;
  const firstAttemptAt = attempt?.first_attempt_at ?? new Date().toISOString();
  const blockedUntil =
    nextCount >= MAX_FAILS
      ? new Date(Date.now() + BLOCK_MINUTES * 60 * 1000).toISOString()
      : null;

  if (attempt?.id) {
    await supabase
      .from("mm_verification_attempts")
      .update({
        count: nextCount,
        blocked_until: blockedUntil,
        first_attempt_at: firstAttemptAt,
      })
      .eq("id", attempt.id);
  } else {
    await supabase.from("mm_verification_attempts").insert({
      identifier: mmUserId,
      count: nextCount,
      blocked_until: blockedUntil,
      first_attempt_at: firstAttemptAt,
    });
  }

  return {
    matched: false as const,
    blockedUntil,
    nextCount,
  };
}

export async function clearVerificationState(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("mm_verification_attempts")
    .delete()
    .eq("identifier", mmUserId);
  await supabase
    .from("mm_verification_codes")
    .delete()
    .eq("mm_user_id", mmUserId);
}
