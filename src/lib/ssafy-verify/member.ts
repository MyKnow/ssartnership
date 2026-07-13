import type { SupabaseClient } from "@supabase/supabase-js";
import type { SsafyVerificationClaims } from "./claims";

export type SsafyVerifiedMember = {
  id: string;
  must_change_password: boolean | null;
  ssafy_sub: string | null;
  mm_user_id: string | null;
  mm_username: string | null;
};

export type SsafyVerificationForMember = SsafyVerificationClaims & {
  verificationId: string | null;
  scope: string | null;
};

export function buildMemberSsafyVerificationUpsertPayload(
  memberId: string,
  input: SsafyVerificationForMember,
) {
  const authTimeIso = new Date(input.authTime * 1000).toISOString();
  return {
    member_id: memberId,
    ssafy_sub: input.sub,
    verified_at: authTimeIso,
    auth_time: authTimeIso,
    verification_id: input.verificationId,
    track: input.track,
    track_name: input.trackName,
    last_scope: input.scope,
    updated_at: new Date().toISOString(),
  };
}

export function buildSsafyMemberUpdatePayload(input: SsafyVerificationForMember) {
  const authTimeIso = new Date(input.authTime * 1000).toISOString();

  return {
    ssafy_sub: input.sub,
    ssafy_verified_at: authTimeIso,
    ssafy_auth_time: authTimeIso,
    ssafy_verification_id: input.verificationId,
    ssafy_mattermost_user_id: input.mattermostUserId,
    ssafy_track: input.track,
    ssafy_track_name: input.trackName,
    ssafy_last_scope: input.scope,
    updated_at: new Date().toISOString(),
  };
}

export async function findSsafyVerifiedMember(
  supabase: SupabaseClient,
  input: {
    currentMemberId?: string | null;
    sub: string;
    mattermostUserId?: string | null;
  },
) {
  const select = "id,must_change_password,ssafy_sub,mm_user_id,mm_username";

  if (input.currentMemberId) {
    const { data, error } = await supabase
      .from("members")
      .select(select)
      .eq("id", input.currentMemberId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
    }
    if (data?.ssafy_sub && data.ssafy_sub !== input.sub) {
      return { ok: false as const, errorCode: "SSAFY_MEMBER_CONFLICT" };
    }
    if (data && !data.ssafy_sub) {
      const { data: existingSubject, error: subjectError } = await supabase
        .from("members")
        .select(select)
        .eq("ssafy_sub", input.sub)
        .is("deleted_at", null)
        .maybeSingle();
      if (subjectError) {
        return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
      }
      if (existingSubject && existingSubject.id !== data.id) {
        return { ok: false as const, errorCode: "SSAFY_MEMBER_CONFLICT" };
      }
    }
    return data
      ? { ok: true as const, member: data as SsafyVerifiedMember }
      : { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }

  const { data: bySub, error: subError } = await supabase
    .from("members")
    .select(select)
    .eq("ssafy_sub", input.sub)
    .is("deleted_at", null)
    .maybeSingle();
  if (subError) {
    return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
  }
  if (bySub) {
    return { ok: true as const, member: bySub as SsafyVerifiedMember };
  }

  if (!input.mattermostUserId) {
    return { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }

  const { data: byMattermostId, error: mattermostError } = await supabase
    .from("members")
    .select(select)
    .eq("mm_user_id", input.mattermostUserId)
    .is("deleted_at", null)
    .maybeSingle();
  if (mattermostError) {
    return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
  }
  if (!byMattermostId) {
    return { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }
  if (byMattermostId.ssafy_sub && byMattermostId.ssafy_sub !== input.sub) {
    return { ok: false as const, errorCode: "SSAFY_MEMBER_CONFLICT" };
  }

  return { ok: true as const, member: byMattermostId as SsafyVerifiedMember };
}

export async function updateMemberSsafyVerification(
  supabase: SupabaseClient,
  memberId: string,
  input: SsafyVerificationForMember,
) {
  const payload = buildSsafyMemberUpdatePayload(input);
  const { error } = await supabase
    .from("members")
    .update(payload)
    .eq("id", memberId);
  if (error) {
    return { ok: false as const, errorCode: "MEMBER_UPDATE_FAILED" };
  }

  const { error: verificationError } = await supabase
    .from("member_ssafy_verifications")
    .upsert(buildMemberSsafyVerificationUpsertPayload(memberId, input), {
      onConflict: "member_id",
    });
  if (verificationError) {
    return { ok: false as const, errorCode: "MEMBER_UPDATE_FAILED" };
  }

  return { ok: true as const, payload };
}
