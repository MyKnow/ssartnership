import { cache } from "react";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getMockMemberById, isMockDataSource } from "@/lib/mock/member";

type MemberAudienceRow = {
  id: string;
  generation: number | null;
};

type GraduateProfileAudienceRow = {
  verified_at: string;
};

export type MemberAudienceSnapshot = {
  generation: number | null;
  graduateVerifiedAt: string | null;
};

async function loadMemberAudienceSnapshot(
  memberId: string,
): Promise<MemberAudienceSnapshot | null> {
  if (isMockDataSource()) {
    const member = getMockMemberById(memberId);
    if (!member) {
      return null;
    }

    return {
      generation: member.generation,
      graduateVerifiedAt: member.graduateVerifiedAt,
    };
  }

  const supabase = getSupabaseAdminClient();
  // The graduate profile is keyed by member id, so both reads can run at once;
  // a missing or deleted member still wins below.
  const [memberResult, graduateProfileResult] = await Promise.all([
    supabase
      .from("members")
      .select("id,generation")
      .eq("id", memberId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("graduate_profiles")
      .select("verified_at")
      .eq("member_id", memberId)
      .maybeSingle(),
  ]);

  if (memberResult.error) {
    throw new Error("회원 인증 정보를 불러오지 못했습니다.");
  }

  const member = (memberResult.data as MemberAudienceRow | null) ?? null;
  if (!member?.id) {
    return null;
  }

  if (graduateProfileResult.error) {
    throw new Error("회원 인증 정보를 불러오지 못했습니다.");
  }

  const graduateProfile =
    (graduateProfileResult.data as GraduateProfileAudienceRow | null) ?? null;

  return {
    generation: member.generation,
    graduateVerifiedAt: graduateProfile?.verified_at ?? null,
  };
}

/**
 * Lean audience snapshot for partner visibility, memoized per server request
 * so the layout, page and metadata share one pair of reads.
 */
export const getMemberAudienceSnapshot = cache(loadMemberAudienceSnapshot);
