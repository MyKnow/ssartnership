"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminReviewQueueQuery } from "@/lib/admin-review-queue";
import {
  requireMemberSignupRequestAdmin,
} from "@/lib/admin-access";
import {
  approveMattermostSignupApprovalRequest,
  rejectMattermostSignupApprovalRequest,
} from "@/lib/mm-signup-approval/repository";
import { parseMattermostSignupApprovalDecision } from "@/lib/mm-signup-approval";
import { parseMemberSignupRequestId } from "@/lib/mm-signup-approval/action-input";
import {
  logAdminAction,
  scheduleAdminActionFailureLog,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { sanitizeReturnTo } from "@/lib/return-to";

const QUEUE_PATH = "/admin/member-signup-requests";

function getRequestId(formData: FormData) {
  return parseMemberSignupRequestId(formData.get("requestId"));
}

function getReturnTo(formData: FormData) {
  return sanitizeReturnTo(String(formData.get("returnTo") ?? ""), QUEUE_PATH);
}

function detailPath(requestId: string, returnTo: string) {
  return appendAdminReviewQueueQuery(
    `${QUEUE_PATH}/${encodeURIComponent(requestId)}`,
    { returnTo },
  );
}

export async function approveMemberSignupRequestAction(formData: FormData) {
  const requestId = getRequestId(formData);
  if (!requestId) {
    redirect(appendAdminReviewQueueQuery(QUEUE_PATH, { error: "invalid_fields" }));
  }
  const returnTo = getReturnTo(formData);
  const path = detailPath(requestId, returnTo);
  const session = await requireMemberSignupRequestAdmin("update", { path });
  const parsed = parseMattermostSignupApprovalDecision({
    displayName: formData.get("displayName"),
    generation: formData.get("generation"),
    campus: formData.get("campus"),
  });
  if (!parsed.ok) {
    redirect(appendAdminReviewQueueQuery(path, { error: "invalid_fields" }));
  }

  try {
    await approveMattermostSignupApprovalRequest({
      requestId,
      adminId: session.adminId,
      ...parsed.value,
    });
  } catch {
    scheduleAdminActionFailureLog("member_signup_approval_approve", {
      targetType: "member_signup_approval_request",
      targetId: requestId,
      reason: "approval_failed",
    });
    redirect(appendAdminReviewQueueQuery(path, { error: "approval_failed" }));
  }

  await logAdminAction("member_signup_approval_approve", {
    targetType: "member_signup_approval_request",
    targetId: requestId,
    properties: {
      generation: parsed.value.generation,
      campus: parsed.value.campus,
    },
  });
  revalidatePath(QUEUE_PATH);
  revalidatePath(`${QUEUE_PATH}/${encodeURIComponent(requestId)}`);
  revalidatePath("/admin/members");
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "approved" }));
}

export async function rejectMemberSignupRequestAction(formData: FormData) {
  const requestId = getRequestId(formData);
  if (!requestId) {
    redirect(appendAdminReviewQueueQuery(QUEUE_PATH, { error: "invalid_fields" }));
  }
  const returnTo = getReturnTo(formData);
  const path = detailPath(requestId, returnTo);
  const session = await requireMemberSignupRequestAdmin("update", { path });
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > 500) {
    redirect(appendAdminReviewQueueQuery(path, { error: "invalid_reason" }));
  }

  try {
    await rejectMattermostSignupApprovalRequest({
      requestId,
      adminId: session.adminId,
      reason,
    });
  } catch {
    scheduleAdminActionFailureLog("member_signup_approval_reject", {
      targetType: "member_signup_approval_request",
      targetId: requestId,
      reason: "rejection_failed",
    });
    redirect(appendAdminReviewQueueQuery(path, { error: "rejection_failed" }));
  }

  await logAdminAction("member_signup_approval_reject", {
    targetType: "member_signup_approval_request",
    targetId: requestId,
    properties: { reasonLength: reason.length },
  });
  revalidatePath(QUEUE_PATH);
  revalidatePath(`${QUEUE_PATH}/${encodeURIComponent(requestId)}`);
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "rejected" }));
}
