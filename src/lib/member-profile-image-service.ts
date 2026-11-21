import { supersedePendingProfileImages, insertPendingProfileImage, deletePendingProfileImage, findActiveProfileImageMember, findMemberProfileImageByStoragePath } from "./repositories/supabase/member-profile-image-records.supabase";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ADMIN_REVIEW_NOTE_MAX_LENGTH } from "@/lib/admin-review-queue";
import type { ImageUploadActor } from "@/lib/image-upload/repository";
import { attachCommonProfileImageUpload } from "@/lib/member-profile-image-upload.server";

export async function approveMemberProfileImageReplacement(input: {
  imageId: string;
  adminId: string;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "approve_member_profile_image_replacement",
    { p_image_id: input.imageId, p_admin_id: input.adminId },
  );
  if (error || typeof data !== "string") {
    throw new Error("본인 사진 교체를 승인하지 못했습니다.");
  }
  return data;
}

export async function rejectMemberProfileImageReplacement(input: {
  imageId: string;
  adminId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason || reason.length > ADMIN_REVIEW_NOTE_MAX_LENGTH) {
    throw new Error(`반려 사유를 1~${ADMIN_REVIEW_NOTE_MAX_LENGTH}자로 입력해 주세요.`);
  }
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reject_member_profile_image_replacement",
    {
      p_image_id: input.imageId,
      p_admin_id: input.adminId,
      p_reason: reason,
    },
  );
  if (error || typeof data !== "string") {
    throw new Error("본인 사진 교체 반려를 처리하지 못했습니다.");
  }
  return data;
}

export async function rejectMemberActiveProfilePhoto(input: {
  memberId: string;
  adminId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason || reason.length > ADMIN_REVIEW_NOTE_MAX_LENGTH) {
    throw new Error(`반려 사유는 1~${ADMIN_REVIEW_NOTE_MAX_LENGTH}자로 입력해 주세요.`);
  }
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reject_member_active_profile_photo",
    {
      p_member_id: input.memberId,
      p_admin_id: input.adminId,
      p_reason: reason,
    },
  );
  if (error || typeof data !== "string") {
    throw new Error("기존 프로필 사진을 반려하지 못했습니다.");
  }
  return data;
}

type ResolvedMemberProfileReplacement = {
  path: string;
  sha256: string;
  width: number;
  height: number;
};

async function resolveMemberProfileReplacement(input: {
  uploadId: string;
  actor: ImageUploadActor;
  destinationPath: string;
  resource: { type: string; id: string };
}): Promise<ResolvedMemberProfileReplacement> {
  const attached = await attachCommonProfileImageUpload({
    actor: input.actor,
    purpose: "profile",
    uploadId: input.uploadId,
    destinationPath: input.destinationPath,
    resource: input.resource,
  });
  return { ...attached, path: attached.storagePath };
}

export async function submitMemberProfileImageReplacement(input: {
  memberId: string;
  uploadId: string;
}) {
  const member = await findActiveProfileImageMember(input.memberId);
  if (!member?.id) {
    throw new Error("회원 정보를 확인하지 못했습니다.");
  }
  const image = await resolveMemberProfileReplacement({
    uploadId: input.uploadId,
    actor: { kind: "member", id: input.memberId },
    destinationPath: `members/${input.memberId}/uploads/${input.uploadId}.webp`,
    resource: { type: "member_profile_replacement", id: input.memberId },
  });
  const existing = await findMemberProfileImageByStoragePath(image.path);
  if (existing) {
    if (existing.memberId !== input.memberId) {
      throw new Error("프로필 사진의 회원 연결을 확인하지 못했습니다.");
    }
    return { imageId: existing.id };
  }
  let profileImageId: string | null = null;
  try {
    const { error: supersedeError } = await supersedePendingProfileImages(input.memberId);
    if (supersedeError) {
      throw new Error("기존 사진 변경 대기를 정리하지 못했습니다.");
    }
    const { data, error } = await insertPendingProfileImage({
        member_id: input.memberId,
        storage_path: image.path,
        sha256: image.sha256,
        content_type: "image/webp",
        width: image.width,
        height: image.height,
        source: "member_upload",
        status: "pending",
      });
    if (error || !data?.id) throw new Error("본인 사진 변경 요청을 저장하지 못했습니다.");
    profileImageId = data.id;
    return { imageId: data.id };
  } catch (error) {
    if (profileImageId) {
      await deletePendingProfileImage(profileImageId);
    }
    // Keep the attached common image for a retry with the same upload ID.
    throw error;
  }
}

export async function replaceMemberProfileImageByAdmin(input: {
  memberId: string;
  uploadId: string;
  adminId: string;
}) {
  const member = await findActiveProfileImageMember(input.memberId);
  if (!member?.id) {
    throw new Error("회원 정보를 확인하지 못했습니다.");
  }
  const image = await resolveMemberProfileReplacement({
    uploadId: input.uploadId,
    actor: { kind: "admin", id: input.adminId },
    destinationPath: `members/${input.memberId}/admin-uploads/${input.uploadId}.webp`,
    resource: { type: "admin_member_profile_replacement", id: input.memberId },
  });
  const existing = await findMemberProfileImageByStoragePath(image.path);
  if (existing) {
    if (existing.memberId !== input.memberId) {
      throw new Error("프로필 사진의 회원 연결을 확인하지 못했습니다.");
    }
    if (existing.status === "pending") {
      await approveMemberProfileImageReplacement({
        imageId: existing.id,
        adminId: input.adminId,
      });
    }
    return { imageId: existing.id };
  }
  let profileImageId: string | null = null;
  try {
    const { error: supersedeError } = await supersedePendingProfileImages(input.memberId);
    if (supersedeError) {
      throw new Error("기존 사진 변경 대기를 정리하지 못했습니다.");
    }

    const { data, error } = await insertPendingProfileImage({
        member_id: input.memberId,
        storage_path: image.path,
        sha256: image.sha256,
        content_type: "image/webp",
        width: image.width,
        height: image.height,
        source: "manual_admin",
        status: "pending",
      });
    if (error || !data?.id) {
      throw new Error("관리자 사진 변경을 저장하지 못했습니다.");
    }
    profileImageId = data.id;
    await approveMemberProfileImageReplacement({
      imageId: data.id,
      adminId: input.adminId,
    });
    return { imageId: data.id };
  } catch (error) {
    if (profileImageId) {
      await deletePendingProfileImage(profileImageId);
    }
    // Keep the attached common image for a retry with the same upload ID.
    throw error;
  }
}
