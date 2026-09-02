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

export async function getMemberAudienceSnapshot(
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
  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("id,generation")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();

  if (memberError) {
    throw new Error("회원 인증 정보를 불러오지 못했습니다.");
  }

  const member = (memberData as MemberAudienceRow | null) ?? null;
  if (!member?.id) {
    return null;
  }

  const { data: graduateProfileData, error: graduateProfileError } = await supabase
    .from("graduate_profiles")
    .select("verified_at")
    .eq("member_id", member.id)
    .maybeSingle();

  if (graduateProfileError) {
    throw new Error("회원 인증 정보를 불러오지 못했습니다.");
  }

  const graduateProfile =
    (graduateProfileData as GraduateProfileAudienceRow | null) ?? null;

  return {
    generation: member.generation,
    graduateVerifiedAt: graduateProfile?.verified_at ?? null,
  };
}
