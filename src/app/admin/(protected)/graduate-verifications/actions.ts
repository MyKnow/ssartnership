"use server";

import { revalidatePath } from "next/cache";
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
import { logAdminAction, scheduleAdminActionFailureLog } from "@/app/admin/(protected)/_actions/shared-helpers";

const ADMIN_GRADUATE_VERIFICATIONS_PATH = "/admin/graduate-verifications";

function getRequiredId(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error("요청 식별자를 확인해 주세요.");
  }
  return value;
}

function getOptionalId(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return null;
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error("기존 회원 식별자를 확인해 주세요.");
  }
  return value;
}

function revalidateGraduateVerificationPaths() {
  revalidatePath("/admin");
  revalidatePath(ADMIN_GRADUATE_VERIFICATIONS_PATH);
  revalidatePath("/admin/members");
}

export async function startGraduateVerificationReviewAction(formData: FormData) {
  const requestId = getRequiredId(formData, "requestId");
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: ADMIN_GRADUATE_VERIFICATIONS_PATH,
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
    throw new Error("검토를 시작하지 못했습니다.");
  }
}

export async function requestGraduateVerificationResubmissionAction(formData: FormData) {
  const requestId = getRequiredId(formData, "requestId");
  const targets = formData.getAll("target").map(String);
  const note = String(formData.get("note") ?? "").trim() || null;
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: ADMIN_GRADUATE_VERIFICATIONS_PATH,
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
    throw new Error("보완 요청을 처리하지 못했습니다.");
  }
}

export async function approveGraduateVerificationAction(formData: FormData) {
  const requestId = getRequiredId(formData, "requestId");
  const existingMemberId = getOptionalId(formData, "existingMemberId");
  const documentNumber = validateGraduateDocumentNumber(
    String(formData.get("documentNumber") ?? ""),
  );
  if (!documentNumber) {
    throw new Error("수료증 문서 번호를 3~160자로 입력해 주세요.");
  }
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: ADMIN_GRADUATE_VERIFICATIONS_PATH,
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
    throw new Error("수료생 인증을 승인하지 못했습니다.");
  }
}

export async function resendGraduateAccountSetupEmailAction(formData: FormData) {
  const requestId = getRequiredId(formData, "requestId");
  await requireAdminPermission("graduate_verifications", "update", {
    path: ADMIN_GRADUATE_VERIFICATIONS_PATH,
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
    throw new Error("비밀번호 설정 메일을 다시 보내지 못했습니다.");
  }
}

export async function rejectGraduateVerificationAction(formData: FormData) {
  const requestId = getRequiredId(formData, "requestId");
  const reason = String(formData.get("reason") ?? "");
  const session = await requireAdminPermission("graduate_verifications", "update", {
    path: ADMIN_GRADUATE_VERIFICATIONS_PATH,
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
    throw new Error("수료생 인증을 반려하지 못했습니다.");
  }
}
