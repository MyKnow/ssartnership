import "server-only";

import {
  getMemberCanonicalProfile,
  getMemberProfileImageUrl,
  type MemberCanonicalProfile,
} from "@/lib/member-profile-view";
import { getMemberProfilePhotoAccessState } from "@/lib/member-profile-photo";

type CertificationMemberSource = Pick<
  MemberCanonicalProfile,
  | "id"
  | "mattermostUsername"
  | "displayName"
  | "generation"
  | "campus"
  | "graduateVerifiedAt"
  | "mustChangePassword"
  | "activeProfileImageId"
  | "profilePhotoReviewStatus"
>;

export type CertificationCardMember = {
  mattermostUsername: string | null;
  displayName: string | null;
  generation: number | null;
  campus: string | null;
  graduateVerifiedAt: string | null;
  profileImageUrl: string | null;
};

export function resolveCertificationMemberView(
  source: CertificationMemberSource,
) {
  const photoAccess = getMemberProfilePhotoAccessState(
    source.profilePhotoReviewStatus,
  );
  const profileImageUrl =
    !photoAccess.restrictCertification &&
    source.activeProfileImageId &&
    source.profilePhotoReviewStatus === "approved" &&
    !source.mustChangePassword
      ? getMemberProfileImageUrl(source.id)
      : null;

  return {
    member: {
      mattermostUsername: source.mattermostUsername,
      displayName: source.displayName,
      generation: source.generation,
      campus: source.campus,
      graduateVerifiedAt: source.graduateVerifiedAt,
      profileImageUrl,
    } satisfies CertificationCardMember,
    photoAccess,
  };
}

export async function getCertificationMemberView(memberId: string) {
  const member = await getMemberCanonicalProfile(memberId);
  return member ? resolveCertificationMemberView(member) : null;
}
