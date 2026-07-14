"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction, scheduleAdminActionFailureLog } from "@/app/admin/(protected)/_actions/shared-helpers";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  approveMemberProfileImageReplacement,
  rejectMemberActiveProfilePhoto,
  rejectMemberProfileImageReplacement,
} from "@/lib/graduate-verification-service";

const PROFILE_PHOTOS_PATH = "/admin/profile-photos";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRequiredId(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!UUID_PATTERN.test(value)) {
    throw new Error("사진 검토 대상을 확인해 주세요.");
  }
  return value;
}

function getRequiredReason(formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > 500) {
    throw new Error("반려 사유를 1~500자로 입력해 주세요.");
  }
  return reason;
}

function getOptionalMemberId(formData: FormData) {
  const value = String(formData.get("memberId") ?? "").trim();
  return UUID_PATTERN.test(value) ? value : null;
}

function revalidateProfilePhotoPaths(memberId?: string | null) {
  revalidatePath("/admin");
  revalidatePath(PROFILE_PHOTOS_PATH);
  revalidatePath("/admin/members");
  if (memberId) revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/certification");
  revalidatePath("/certification/photo");
}

export async function approveMemberProfilePhotoAction(formData: FormData) {
  const imageId = getRequiredId(formData, "imageId");
  const memberId = getOptionalMemberId(formData);
  const session = await requireAdminPermission("profile_images", "update", {
    path: PROFILE_PHOTOS_PATH,
  });

  try {
    await approveMemberProfileImageReplacement({ imageId, adminId: session.adminId });
    await logAdminAction("member_profile_photo_approve", {
      targetType: "member_profile_image",
      targetId: imageId,
    });
    revalidateProfilePhotoPaths(memberId);
  } catch {
    scheduleAdminActionFailureLog("member_profile_photo_approve", {
      targetType: "member_profile_image",
      targetId: imageId,
      reason: "approval_failed",
    });
    throw new Error("본인 사진 교체를 승인하지 못했습니다.");
  }
}

export async function rejectMemberProfilePhotoAction(formData: FormData) {
  const imageId = getRequiredId(formData, "imageId");
  const reason = getRequiredReason(formData);
  const memberId = getOptionalMemberId(formData);
  const session = await requireAdminPermission("profile_images", "update", {
    path: PROFILE_PHOTOS_PATH,
  });

  try {
    await rejectMemberProfileImageReplacement({ imageId, adminId: session.adminId, reason });
    await logAdminAction("member_profile_photo_reject", {
      targetType: "member_profile_image",
      targetId: imageId,
      properties: { reasonLength: reason.length },
    });
    revalidateProfilePhotoPaths(memberId);
  } catch {
    scheduleAdminActionFailureLog("member_profile_photo_reject", {
      targetType: "member_profile_image",
      targetId: imageId,
      reason: "rejection_failed",
    });
    throw new Error("본인 사진 교체를 반려하지 못했습니다.");
  }
}

export async function rejectMemberCurrentProfilePhotoAction(formData: FormData) {
  const memberId = getRequiredId(formData, "memberId");
  const reason = getRequiredReason(formData);
  const session = await requireAdminPermission("profile_images", "update", {
    path: PROFILE_PHOTOS_PATH,
  });

  try {
    await rejectMemberActiveProfilePhoto({ memberId, adminId: session.adminId, reason });
    await logAdminAction("member_profile_photo_active_reject", {
      targetType: "member",
      targetId: memberId,
      properties: { reasonLength: reason.length },
    });
    revalidateProfilePhotoPaths(memberId);
  } catch {
    scheduleAdminActionFailureLog("member_profile_photo_active_reject", {
      targetType: "member",
      targetId: memberId,
      reason: "active_photo_rejection_failed",
    });
    throw new Error("기존 프로필 사진을 반려하지 못했습니다.");
  }
}
