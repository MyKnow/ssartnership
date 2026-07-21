import { isUuid } from "@/lib/uuid";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import { ImageUploadError } from "@/lib/image-upload/repository";
import type { ImageUploadActor } from "@/lib/image-upload/repository";
import { MEMBER_PROFILE_IMAGES_BUCKET } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const SIGNUP_PROFILE_PURPOSE = "member-signup-profile" as const;

export class SignupProfileImageError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SignupProfileImageError";
    this.code = code;
  }
}

async function attachSignupProfileUpload(input: {
  uploadId: string;
  signupUploadOwnerId: string;
  destinationPath: string;
  resourceType: string;
  resourceId: string;
}) {
  if (!isUuid(input.uploadId) || !isUuid(input.signupUploadOwnerId)) {
    throw new SignupProfileImageError(
      "profile_image_input_invalid",
      "가입 프로필 이미지 연결 정보를 확인해 주세요.",
    );
  }
  let attached;
  try {
    attached = await getImageUploadRepository().attach({
      actor: { kind: "signup", id: input.signupUploadOwnerId },
      purpose: SIGNUP_PROFILE_PURPOSE,
      uploadId: input.uploadId,
      role: "profile",
      policy: resolveImageTransformPolicy(SIGNUP_PROFILE_PURPOSE, "profile"),
      destination: {
        bucket: MEMBER_PROFILE_IMAGES_BUCKET,
        path: input.destinationPath,
        isPublic: false,
        cacheControl: "private, no-store",
      },
      resource: {
        type: input.resourceType,
        id: input.resourceId,
      },
    });
  } catch (error) {
    if (error instanceof SignupProfileImageError) throw error;
    if (error instanceof ImageUploadError && error.code.startsWith("profile_image_")) {
      throw new SignupProfileImageError(error.code, error.message, { cause: error });
    }
    throw new SignupProfileImageError(
      "profile_image_attach",
      "가입 프로필 이미지 연결에 실패했습니다.",
      { cause: error },
    );
  }
  if (attached.width !== 640 || attached.height !== 640 || attached.sha256.length !== 64) {
    throw new SignupProfileImageError(
      "profile_image_dimensions",
      "가입 프로필 이미지 규격을 확인해 주세요.",
    );
  }
  return attached;
}

export async function attachMattermostSignupApprovalProfileImage(input: {
  requestId: string;
  uploadId: string;
  signupUploadOwnerId: string;
}) {
  if (!isUuid(input.requestId)) {
    throw new SignupProfileImageError(
      "profile_image_input_invalid",
      "가입 승인 요청 식별자를 확인해 주세요.",
    );
  }
  return attachSignupProfileUpload({
    uploadId: input.uploadId,
    signupUploadOwnerId: input.signupUploadOwnerId,
    destinationPath: `members/signup-approvals/${input.requestId}.webp`,
    resourceType: "member_signup_approval",
    resourceId: input.requestId,
  });
}

export async function attachMattermostSignupProfileImage(input: {
  memberId: string;
  uploadId: string;
  signupUploadOwnerId: string;
}) {
  if (!isUuid(input.memberId) || !isUuid(input.uploadId) || !isUuid(input.signupUploadOwnerId)) {
    throw new SignupProfileImageError(
      "profile_image_input_invalid",
      "가입 프로필 이미지 연결 정보를 확인해 주세요.",
    );
  }

  const actor: ImageUploadActor = { kind: "signup", id: input.signupUploadOwnerId };
  const destinationPath = `members/${input.memberId}/signup/${input.uploadId}.webp`;
  const attached = await attachSignupProfileUpload({
    uploadId: input.uploadId,
    signupUploadOwnerId: actor.id,
    destinationPath,
    resourceType: "member_signup",
    resourceId: input.memberId,
  });
  if (attached.width !== 640 || attached.height !== 640 || attached.sha256.length !== 64) {
    throw new SignupProfileImageError(
      "profile_image_dimensions",
      "가입 프로필 이미지 규격을 확인해 주세요.",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("member_profile_images")
    .select("id,member_id")
    .eq("storage_path", attached.path)
    .maybeSingle();
  if (existingError) {
    throw new SignupProfileImageError(
      "profile_image_ledger_lookup",
      "가입 프로필 이미지 상태를 확인하지 못했습니다.",
      { cause: existingError },
    );
  }
  let imageId = typeof existing?.id === "string" ? existing.id : null;
  if (existing && existing.member_id !== input.memberId) {
    throw new SignupProfileImageError(
      "profile_image_ledger_conflict",
      "프로필 이미지가 다른 회원에 연결되어 있습니다.",
    );
  }
  if (!imageId) {
    const { data: inserted, error: insertError } = await supabase
      .from("member_profile_images")
      .insert({
        member_id: input.memberId,
        storage_path: attached.path,
        sha256: attached.sha256,
        content_type: "image/webp",
        width: attached.width,
        height: attached.height,
        source: "mattermost",
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      throw new SignupProfileImageError(
        "profile_image_ledger_insert",
        "가입 프로필 이미지 정보를 저장하지 못했습니다.",
        { cause: insertError ?? undefined },
      );
    }
    imageId = inserted.id as string;
  }

  // The member domain now derives the active image from the canonical
  // member_profile_images ledger. The legacy members pointer columns were
  // removed by the domain contract migration, so the approved ledger row is
  // the complete attachment record for a new signup.
  return { imageId, storagePath: attached.path };
}
