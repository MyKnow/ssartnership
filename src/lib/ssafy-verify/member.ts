import type { SupabaseClient } from "@supabase/supabase-js";
import type { SsafyVerificationClaims } from "./claims";

export type SsafyVerifiedMember = {
  id: string;
  must_change_password: boolean | null;
  mattermost_account_id: string | null;
  updated_at: string;
};

export type SsafyVerificationForMember = SsafyVerificationClaims & {
  verificationId: string | null;
  scope: string | null;
};

type StoredSsafyVerification = {
  member_id: string;
  ssafy_sub: string;
};

type MattermostDirectoryEntry = {
  id: string;
};

const MEMBER_SELECT = "id,must_change_password,mattermost_account_id,updated_at";
const VERIFICATION_SELECT = "member_id,ssafy_sub";

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

async function findActiveMemberById(
  supabase: SupabaseClient,
  memberId: string,
) {
  const { data, error } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    data: (data as SsafyVerifiedMember | null) ?? null,
    error,
  };
}

async function findActiveMemberByMattermostAccountId(
  supabase: SupabaseClient,
  mattermostAccountId: string,
) {
  const { data, error } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("mattermost_account_id", mattermostAccountId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    data: (data as SsafyVerifiedMember | null) ?? null,
    error,
  };
}

async function findVerificationByMemberId(
  supabase: SupabaseClient,
  memberId: string,
) {
  const { data, error } = await supabase
    .from("member_ssafy_verifications")
    .select(VERIFICATION_SELECT)
    .eq("member_id", memberId)
    .maybeSingle();

  return {
    data: (data as StoredSsafyVerification | null) ?? null,
    error,
  };
}

async function findVerificationBySubject(
  supabase: SupabaseClient,
  subject: string,
) {
  const { data, error } = await supabase
    .from("member_ssafy_verifications")
    .select(VERIFICATION_SELECT)
    .eq("ssafy_sub", subject)
    .maybeSingle();

  return {
    data: (data as StoredSsafyVerification | null) ?? null,
    error,
  };
}

async function findMattermostDirectoryByUserId(
  supabase: SupabaseClient,
  mattermostUserId: string,
) {
  const { data, error } = await supabase
    .from("mm_user_directory")
    .select("id")
    .eq("mm_user_id", mattermostUserId)
    .maybeSingle();

  return {
    data: (data as MattermostDirectoryEntry | null) ?? null,
    error,
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
  if (input.currentMemberId) {
    const { data, error } = await findActiveMemberById(
      supabase,
      input.currentMemberId,
    );
    if (error) {
      return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
    }
    if (!data) {
      return { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
    }

    const currentVerification = await findVerificationByMemberId(
      supabase,
      data.id,
    );
    if (currentVerification.error) {
      return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
    }
    if (
      currentVerification.data?.ssafy_sub &&
      currentVerification.data.ssafy_sub !== input.sub
    ) {
      return { ok: false as const, errorCode: "SSAFY_MEMBER_CONFLICT" };
    }

    const existingSubject = await findVerificationBySubject(supabase, input.sub);
    if (existingSubject.error) {
      return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
    }
    if (
      existingSubject.data &&
      existingSubject.data.member_id !== data.id
    ) {
      return { ok: false as const, errorCode: "SSAFY_MEMBER_CONFLICT" };
    }
    return { ok: true as const, member: data };
  }

  const bySubject = await findVerificationBySubject(supabase, input.sub);
  if (bySubject.error) {
    return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
  }
  if (bySubject.data) {
    const member = await findActiveMemberById(
      supabase,
      bySubject.data.member_id,
    );
    if (member.error) {
      return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
    }
    return member.data
      ? { ok: true as const, member: member.data }
      : { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }

  if (!input.mattermostUserId) {
    return { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }

  const directory = await findMattermostDirectoryByUserId(
    supabase,
    input.mattermostUserId,
  );
  if (directory.error) {
    return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
  }
  if (!directory.data) {
    return { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }

  const member = await findActiveMemberByMattermostAccountId(
    supabase,
    directory.data.id,
  );
  if (member.error) {
    return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
  }
  if (!member.data) {
    return { ok: false as const, errorCode: "MEMBER_NOT_FOUND" };
  }

  const existingVerification = await findVerificationByMemberId(
    supabase,
    member.data.id,
  );
  if (existingVerification.error) {
    return { ok: false as const, errorCode: "MEMBER_LOOKUP_FAILED" };
  }
  if (
    existingVerification.data?.ssafy_sub &&
    existingVerification.data.ssafy_sub !== input.sub
  ) {
    return { ok: false as const, errorCode: "SSAFY_MEMBER_CONFLICT" };
  }

  return { ok: true as const, member: member.data };
}

export async function updateMemberSsafyVerification(
  supabase: SupabaseClient,
  memberId: string,
  input: SsafyVerificationForMember,
) {
  const payload = buildMemberSsafyVerificationUpsertPayload(memberId, input);
  const { error } = await supabase
    .from("member_ssafy_verifications")
    .upsert(payload, {
      onConflict: "member_id",
    });
  if (error) {
    return { ok: false as const, errorCode: "MEMBER_UPDATE_FAILED" };
  }

  return { ok: true as const, payload };
}
