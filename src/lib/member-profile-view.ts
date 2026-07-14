import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type MemberCanonicalRow = {
  id: string;
  display_name: string | null;
  generation: number | null;
  campus: string | null;
  must_change_password: boolean;
  created_at: string | null;
  updated_at: string | null;
  mattermost_account_id: string | null;
  email: string | null;
  email_verified_at: string | null;
};

type MemberDirectoryRow = {
  mm_user_id: string;
  mm_username: string;
};

type GraduateProfileRow = {
  verified_at: string;
};

export type MemberCanonicalProfile = {
  id: string;
  displayName: string | null;
  generation: number | null;
  campus: string | null;
  mustChangePassword: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  mattermostAccountId: string | null;
  mattermostUserId: string | null;
  mattermostUsername: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  activeProfileImageId: string | null;
  profilePhotoReviewStatus: "missing" | "approved" | "pending" | "rejected";
  graduateVerifiedAt: string | null;
};

export async function getMemberCanonicalProfile(
  memberId: string,
): Promise<MemberCanonicalProfile | null> {
  const supabase = getSupabaseAdminClient();
  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select(
      "id,display_name,generation,campus,must_change_password,created_at,updated_at,mattermost_account_id,email,email_verified_at",
    )
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError) {
    throw new Error("회원 정보를 불러오지 못했습니다.");
  }

  const member = (memberData as MemberCanonicalRow | null) ?? null;
  if (!member?.id) {
    return null;
  }

  const [directoryResult, graduateProfileResult, photoState] = await Promise.all([
    member.mattermost_account_id
      ? supabase
          .from("mm_user_directory")
          .select("mm_user_id,mm_username")
          .eq("id", member.mattermost_account_id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("graduate_profiles")
      .select("verified_at")
      .eq("member_id", member.id)
      .maybeSingle(),
    getMemberProfilePhotoState(member.id),
  ]);
  if (directoryResult.error || graduateProfileResult.error) {
    throw new Error("회원 인증 정보를 불러오지 못했습니다.");
  }

  const directory = (directoryResult.data as MemberDirectoryRow | null) ?? null;
  const graduateProfile =
    (graduateProfileResult.data as GraduateProfileRow | null) ?? null;

  return {
    id: member.id,
    displayName: member.display_name,
    generation: member.generation,
    campus: member.campus,
    mustChangePassword: member.must_change_password,
    createdAt: member.created_at,
    updatedAt: member.updated_at,
    mattermostAccountId: member.mattermost_account_id,
    mattermostUserId: directory?.mm_user_id ?? null,
    mattermostUsername: directory?.mm_username ?? null,
    email: member.email,
    emailVerifiedAt: member.email_verified_at,
    activeProfileImageId: photoState.activeProfileImageId,
    profilePhotoReviewStatus: photoState.reviewStatus,
    graduateVerifiedAt: graduateProfile?.verified_at ?? null,
  };
}
