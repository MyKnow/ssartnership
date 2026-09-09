"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminReviewQueueQuery } from "@/lib/admin-review-queue";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  approveGraduateVerificationRequest,
  markGraduateVerificationInReview,
  rejectGraduateVerificationRequest,
  resendGraduateAccountSetupEmail,
  requestGraduateVerificationResubmission,
} from "@/lib/graduate-verification-service";
import {
  hashGraduateDocumentNumber,
} from "@/lib/graduate-verification-security";
import { validateGraduateDocumentNumber } from "@/lib/graduate-verification";
import {
  logAdminAction,
  redirectAdminActionError,
  scheduleAdminActionFailureLog,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { sanitizeReturnTo } from "@/lib/return-to";
import { isUuid } from "@/lib/uuid";

const ADMIN_GRADUATE_VERIFICATIONS_PATH = "/admin/graduate-verifications";

function getReturnTo(formData: FormData) {
  return sanitizeReturnTo(
    String(formData.get("returnTo") ?? ""),
    ADMIN_GRADUATE_VERIFICATIONS_PATH,
  );
}

function getRequiredId(formData: FormData, name: string, returnTo: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!isUuid(value)) {
    redirectAdminActionError(returnTo, "invalid_fields");
  }
  return value;
}

function getOptionalId(formData: FormData, name: string, returnTo: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return null;
  if (!isUuid(value)) {
    redirectAdminActionError(returnTo, "invalid_fields");
  }
  return value;
}

function revalidateGraduateVerificationPaths() {
  revalidatePath("/admin");
  revalidatePath(ADMIN_GRADUATE_VERIFICATIONS_PATH);
  revalidatePath("/admin/members");
}

export async function startGraduateVerificationReviewAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const requestId = getRequiredId(formData, "requestId", returnTo);
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: returnTo,
  });
  try {
    await markGraduateVerificationInReview({ requestId, adminId: session.adminId });
    await logAdminAction("graduate_verification_review_start", {
      targetType: "graduate_verification_request",
      targetId: requestId,
    });
    revalidateGraduateVerificationPaths();
  } catch {
    scheduleAdminActionFailureLog("graduate_verification_review_start", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      reason: "review_start_failed",
    });
    redirectAdminActionError(returnTo, "review_start_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "updated" }));
}

export async function requestGraduateVerificationResubmissionAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const requestId = getRequiredId(formData, "requestId", returnTo);
  const targets = formData.getAll("target").map(String);
  const note = String(formData.get("note") ?? "").trim() || null;
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: returnTo,
  });
  try {
    const resolvedTargets = await requestGraduateVerificationResubmission({
      requestId,
      targets,
      adminId: session.adminId,
      note,
    });
    await logAdminAction("graduate_verification_resubmission_request", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      properties: {
        targetCount: resolvedTargets.targets.length,
        emailSent: resolvedTargets.emailSent,
      },
    });
    revalidateGraduateVerificationPaths();
  } catch {
    scheduleAdminActionFailureLog("graduate_verification_resubmission_request", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      reason: "resubmission_request_failed",
    });
    redirectAdminActionError(returnTo, "resubmission_request_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "updated" }));
}

export async function approveGraduateVerificationAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const requestId = getRequiredId(formData, "requestId", returnTo);
  const existingMemberId = getOptionalId(formData, "existingMemberId", returnTo);
  const documentNumber = validateGraduateDocumentNumber(
    String(formData.get("documentNumber") ?? ""),
  );
  if (!documentNumber) {
    redirectAdminActionError(returnTo, "invalid_fields");
  }
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: returnTo,
  });
  try {
    const result = await approveGraduateVerificationRequest({
      requestId,
      adminId: session.adminId,
      documentNumberHmac: hashGraduateDocumentNumber(documentNumber),
      existingMemberId,
    });
    await logAdminAction("graduate_verification_approve", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      properties: { setupEmailSent: result.setupEmailSent },
    });
    revalidateGraduateVerificationPaths();
  } catch {
    scheduleAdminActionFailureLog("graduate_verification_approve", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      reason: "approval_failed",
    });
    redirectAdminActionError(returnTo, "approval_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "approved" }));
}

export async function resendGraduateAccountSetupEmailAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const requestId = getRequiredId(formData, "requestId", returnTo);
  await requireAdminPermission("graduate_verifications", "update", {
    path: returnTo,
  });
  try {
    const result = await resendGraduateAccountSetupEmail({ requestId });
    await logAdminAction("graduate_verification_setup_email_resend", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      properties: { setupEmailSent: result.setupEmailSent },
    });
    revalidateGraduateVerificationPaths();
  } catch {
    scheduleAdminActionFailureLog("graduate_verification_setup_email_resend", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      reason: "setup_email_resend_failed",
    });
    redirectAdminActionError(returnTo, "setup_email_resend_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "updated" }));
}

export async function rejectGraduateVerificationAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const requestId = getRequiredId(formData, "requestId", returnTo);
  const reason = String(formData.get("reason") ?? "");
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: returnTo,
  });
  try {
    const result = await rejectGraduateVerificationRequest({ requestId, adminId: session.adminId, reason });
    await logAdminAction("graduate_verification_reject", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      properties: { reasonLength: reason.trim().length, emailSent: result.emailSent },
    });
    revalidateGraduateVerificationPaths();
  } catch {
    scheduleAdminActionFailureLog("graduate_verification_reject", {
      targetType: "graduate_verification_request",
      targetId: requestId,
      reason: "rejection_failed",
    });
    redirectAdminActionError(returnTo, "rejection_failed");
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "rejected" }));
}
