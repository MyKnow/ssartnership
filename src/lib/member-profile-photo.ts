export const MEMBER_PROFILE_PHOTO_REVIEW_STATUSES = [
  "approved",
  "pending",
  "rejected",
] as const;

export type MemberProfilePhotoReviewStatus =
  (typeof MEMBER_PROFILE_PHOTO_REVIEW_STATUSES)[number];

const REVIEW_STATUS_SET = new Set<string>(MEMBER_PROFILE_PHOTO_REVIEW_STATUSES);

export function normalizeMemberProfilePhotoReviewStatus(
  value: unknown,
): MemberProfilePhotoReviewStatus {
  return typeof value === "string" && REVIEW_STATUS_SET.has(value)
    ? (value as MemberProfilePhotoReviewStatus)
    : "approved";
}

export function requiresMemberProfilePhotoUpdate(value: unknown) {
  const status = normalizeMemberProfilePhotoReviewStatus(value);
  return status === "pending" || status === "rejected";
}

export function getMemberProfilePhotoAccessState(value: unknown) {
  const status = normalizeMemberProfilePhotoReviewStatus(value);
  if (status === "pending") {
    return {
      requiresUpdate: true,
      message:
        "본인 사진 변경 요청을 검토하고 있습니다. 인증 서비스를 이용하려면 검토가 끝날 때까지 기다려 주세요.",
    } as const;
  }
  if (status === "rejected") {
    return {
      requiresUpdate: true,
      message:
        "본인 사진을 다시 제출해 주세요. 승인 전에는 인증 서비스를 이용할 수 없습니다.",
    } as const;
  }
  return { requiresUpdate: false, message: null } as const;
}
