import type { ImageUploadActorMode } from "@/lib/image-upload/auth.server";
import type { ImageUploadPurpose } from "@/lib/image-upload/policy";

export const MEMBER_SIGNUP_PROFILE_PURPOSE = "member-signup-profile" as const;
export const MEMBER_SIGNUP_PROFILE_ROLE = "profile" as const;
export const SIGNUP_APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isMemberSignupProfileUploadRequest(input: {
  purpose: ImageUploadPurpose;
  actorMode?: ImageUploadActorMode;
  role?: string;
}) {
  return input.purpose === MEMBER_SIGNUP_PROFILE_PURPOSE
    && input.actorMode === "signup"
    && (input.role === undefined || input.role === MEMBER_SIGNUP_PROFILE_ROLE);
}

export function getSignupApprovalExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SIGNUP_APPROVAL_TTL_MS);
}
