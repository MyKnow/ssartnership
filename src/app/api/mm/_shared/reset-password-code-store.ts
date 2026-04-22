import { generateCode, hashCode } from "@/lib/mm-verification";
import { createDirectChannel, sendPost } from "@/lib/mattermost/channels";
import { loginAsSsafySender } from "./mattermost";
import { getEffectiveSsafyYear, getPreferredStaffSourceYear } from "@/lib/ssafy-year";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { MemberRow } from "@/lib/mm-member-sync";

const CODE_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;

type ResetPasswordAttemptRow = {
  id: string;
  count: number;
  first_attempt_at: string;
  blocked_until?: string | null;
  created_at?: string | null;
};

export async function getResetPasswordAttempt(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("password_reset_attempts")
    .select("id,count,first_attempt_at,blocked_until,created_at")
    .eq("identifier", mmUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ResetPasswordAttemptRow | null) ?? null;
}

export async function getResetPasswordCooldownState(mmUserId: string) {
  const existing = await getResetPasswordAttempt(mmUserId);
  if (!existing?.created_at) {
    return { inCooldown: false as const };
  }

  const createdAt = new Date(existing.created_at);
  const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
  return {
    inCooldown: diffSeconds < RESEND_COOLDOWN_SECONDS,
  } as const;
}

export async function isResetPasswordRequestBlocked(mmUserId: string) {
  const existing = await getResetPasswordAttempt(mmUserId);
  if (!existing?.blocked_until) {
    return null;
  }
  if (new Date(existing.blocked_until).getTime() <= Date.now()) {
    return null;
  }
  return {
    blockedUntil: existing.blocked_until,
  } as const;
}

export async function recordResetPasswordRequestAttempt(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const existing = await getResetPasswordAttempt(mmUserId);
  const now = new Date();

  if (!existing) {
    const { error } = await supabase.from("password_reset_attempts").insert({
      identifier: mmUserId,
      count: 1,
      first_attempt_at: now.toISOString(),
      created_at: now.toISOString(),
    });
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const firstAttemptAt = existing.first_attempt_at ?? now.toISOString();
  const windowStart = new Date(firstAttemptAt).getTime();
  if (now.getTime() - windowStart > RESEND_COOLDOWN_SECONDS * 1000) {
    const { error } = await supabase
      .from("password_reset_attempts")
      .update({
        count: 1,
        first_attempt_at: now.toISOString(),
        blocked_until: null,
        created_at: now.toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const nextCount = (existing.count ?? 0) + 1;
  const updatePayload: {
    count: number;
    blocked_until?: string | null;
    first_attempt_at: string;
    created_at: string;
  } = {
    count: nextCount,
    first_attempt_at: firstAttemptAt,
    created_at: now.toISOString(),
  };

  if (nextCount >= MAX_FAILS) {
    updatePayload.blocked_until = new Date(
      now.getTime() + BLOCK_MINUTES * 60 * 1000,
    ).toISOString();
  }

  const { error } = await supabase
    .from("password_reset_attempts")
    .update(updatePayload)
    .eq("id", existing.id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function clearExistingResetPasswordCodeState(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("password_reset_codes")
    .delete()
    .eq("mm_user_id", mmUserId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function storeResetPasswordCode(input: {
  mmUserId: string;
  mmUsername: string;
  displayName: string | null;
  year: number;
  campus: string | null;
  code: string;
}) {
  const supabase = getSupabaseAdminClient();
  await clearExistingResetPasswordCodeState(input.mmUserId);

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  const { error } = await supabase.from("password_reset_codes").insert({
    code_hash: hashCode(input.code),
    expires_at: expiresAt.toISOString(),
    mm_user_id: input.mmUserId,
    mm_username: input.mmUsername,
    display_name: input.displayName,
    year: input.year,
    campus: input.campus,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function deliverResetPasswordCode(input: {
  member: MemberRow;
  directorySourceYears: number[];
  senderYearFallbacks?: Array<number | null | undefined>;
}) {
  const senderYear = getEffectiveSsafyYear(
    input.member.year,
    input.member.staff_source_year ?? null,
    [
      getPreferredStaffSourceYear(input.directorySourceYears),
      ...(input.senderYearFallbacks ?? [15, 14]),
    ],
  );

  if (senderYear === null) {
    throw new Error("운영진 회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  }

  const senderLogin = await loginAsSsafySender(senderYear);
  const code = generateCode();

  await storeResetPasswordCode({
    mmUserId: input.member.mm_user_id,
    mmUsername: input.member.mm_username,
    displayName: input.member.display_name ?? input.member.mm_username,
    year: input.member.year,
    campus: input.member.campus ?? null,
    code,
  });

  try {
    const dmChannel = await createDirectChannel(
      senderLogin.token,
      senderLogin.user.id,
      input.member.mm_user_id,
    );
    await sendPost(
      senderLogin.token,
      dmChannel.id,
      [
        "SSARTNERSHIP 비밀번호 재설정 인증번호입니다.",
        "",
        "인증번호",
        "```plaintext",
        code,
        "```",
        `유효시간: ${CODE_TTL_MINUTES}분`,
      ].join("\n"),
    );
  } catch (error) {
    await clearExistingResetPasswordCodeState(input.member.mm_user_id);
    throw error;
  }
}

export type ResetPasswordCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string | null;
  year: number;
  campus: string | null;
  created_at: string;
};

export async function getLatestResetPasswordCode(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("password_reset_codes")
    .select(
      "id,code_hash,expires_at,mm_user_id,mm_username,display_name,year,campus,created_at",
    )
    .eq("mm_user_id", mmUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ResetPasswordCodeRow | null) ?? null;
}

export function isResetPasswordCodeExpired(codeRow: ResetPasswordCodeRow | null) {
  if (!codeRow) {
    return true;
  }
  return new Date(codeRow.expires_at) < new Date();
}

export function isResetPasswordCodeValid(
  code: string,
  codeRow: ResetPasswordCodeRow,
) {
  return codeRow.code_hash === hashCode(code);
}
