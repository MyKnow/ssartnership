"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminReviewQueueQuery } from "@/lib/admin-review-queue";
import {
  logAdminAction,
  redirectAdminActionError,
  scheduleAdminActionFailureLog,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  approveMemberProfileImageReplacement,
  rejectMemberActiveProfilePhoto,
  rejectMemberProfileImageReplacement,
} from "@/lib/graduate-verification-service";
import { sanitizeReturnTo } from "@/lib/return-to";

const PROFILE_PHOTOS_PATH = "/admin/profile-photos";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getReturnTo(formData: FormData) {
  return sanitizeReturnTo(String(formData.get("returnTo") ?? ""), PROFILE_PHOTOS_PATH);
}

function getRequiredId(formData: FormData, name: string, returnTo: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!UUID_PATTERN.test(value)) {
    redirectAdminActionError(returnTo, "invalid_fields");
  }
  return value;
}

function getRequiredReason(formData: FormData, returnTo: string) {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > 500) {
    redirectAdminActionError(returnTo, "invalid_reason");
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
  const returnTo = getReturnTo(formData);
  const imageId = getRequiredId(formData, "imageId", returnTo);
  const memberId = getOptionalMemberId(formData);
  const session = await requireAdminPermission("profile_images", "update", {
    path: returnTo,
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
    redirectAdminActionError(returnTo, "approval_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "approved" }));
}

export async function rejectMemberProfilePhotoAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const imageId = getRequiredId(formData, "imageId", returnTo);
  const reason = getRequiredReason(formData, returnTo);
  const memberId = getOptionalMemberId(formData);
  const session = await requireAdminPermission("profile_images", "update", {
    path: returnTo,
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
    redirectAdminActionError(returnTo, "rejection_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "rejected" }));
}

export async function rejectMemberCurrentProfilePhotoAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const memberId = getRequiredId(formData, "memberId", returnTo);
  const reason = getRequiredReason(formData, returnTo);
  const session = await requireAdminPermission("profile_images", "update", {
    path: returnTo,
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
    redirectAdminActionError(returnTo, "active_photo_rejection_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "rejected" }));
}
