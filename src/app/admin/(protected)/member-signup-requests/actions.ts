"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireMemberSignupRequestAdmin,
} from "@/lib/admin-access";
import {
  approveMattermostSignupApprovalRequest,
  rejectMattermostSignupApprovalRequest,
} from "@/lib/mm-signup-approval/repository";
import { parseMattermostSignupApprovalDecision } from "@/lib/mm-signup-approval";
import { isUuid } from "@/lib/uuid";
import {
  logAdminAction,
  scheduleAdminActionFailureLog,
} from "@/app/admin/(protected)/_actions/shared-helpers";

const QUEUE_PATH = "/admin/member-signup-requests";

function getRequestId(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) {
    throw new Error("가입 승인 요청 식별자를 확인해 주세요.");
  }
  return requestId;
}

function detailPath(requestId: string) {
  return `${QUEUE_PATH}/${encodeURIComponent(requestId)}`;
}

export async function approveMemberSignupRequestAction(formData: FormData) {
  const requestId = getRequestId(formData);
  const path = detailPath(requestId);
  const session = await requireMemberSignupRequestAdmin("update", { path });
  const parsed = parseMattermostSignupApprovalDecision({
    displayName: formData.get("displayName"),
    generation: formData.get("generation"),
    campus: formData.get("campus"),
  });
  if (!parsed.ok) {
    redirect(`${path}?error=invalid_fields`);
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
    redirect(`${path}?error=approval_failed`);
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
  revalidatePath(path);
  revalidatePath("/admin/members");
  redirect(`${QUEUE_PATH}?status=approved`);
}

export async function rejectMemberSignupRequestAction(formData: FormData) {
  const requestId = getRequestId(formData);
  const path = detailPath(requestId);
  const session = await requireMemberSignupRequestAdmin("update", { path });
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > 500) {
    redirect(`${path}?error=invalid_reason`);
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
    redirect(`${path}?error=rejection_failed`);
  }

  await logAdminAction("member_signup_approval_reject", {
    targetType: "member_signup_approval_request",
    targetId: requestId,
    properties: { reasonLength: reason.length },
  });
  revalidatePath(QUEUE_PATH);
  revalidatePath(path);
  redirect(`${QUEUE_PATH}?status=rejected`);
}
