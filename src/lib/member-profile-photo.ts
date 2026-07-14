export const MEMBER_PROFILE_PHOTO_REVIEW_STATUSES = [
  "missing",
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
    : "missing";
}

export function requiresMemberProfilePhotoUpdate(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  const status = normalizeMemberProfilePhotoReviewStatus(value);
  return status === "missing";
}

export function getMemberProfilePhotoAccessState(value: unknown) {
  const status = normalizeMemberProfilePhotoReviewStatus(value);
  if (status === "missing") {
    return {
      requiresSubmission: true,
      restrictCertification: true,
      message: "본인 사진을 제출한 뒤 서비스를 이용할 수 있습니다.",
    } as const;
  }
  if (status === "pending") {
    return {
      requiresSubmission: false,
      restrictCertification: true,
      message:
        "본인 사진 변경 요청을 검토하고 있습니다. 인증 서비스를 이용하려면 검토가 끝날 때까지 기다려 주세요.",
    } as const;
  }
  if (status === "rejected") {
    return {
      requiresSubmission: false,
      restrictCertification: true,
      message:
        "본인 사진을 다시 제출해 주세요. 승인 전에는 인증 서비스를 이용할 수 없습니다.",
    } as const;
  }
  return {
    requiresSubmission: false,
    restrictCertification: false,
    message: null,
  } as const;
}
