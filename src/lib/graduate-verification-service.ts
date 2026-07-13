import { randomUUID } from "node:crypto";
import {
  createGraduateVerificationSubmission,
  getGraduateResubmissionTargets,
  getGraduateSubmissionFileRequirements,
  validateGraduateCertificateUpload,
  type GraduateResubmissionTarget,
} from "@/lib/graduate-verification";
import {
  getGraduateFileSha256,
  inspectGraduateCertificatePdf,
  normalizeGraduateProfileImage,
} from "@/lib/graduate-verification-files";
import {
  downloadGraduateVerificationUpload,
  discardGraduateVerificationUpload,
  getGraduateMemberProfileReplacementUpload,
  getGraduateVerificationUpload,
  markGraduateVerificationUploadsConsumed,
  promoteGraduateCertificate,
  removeGraduateStoredObject,
  storeGraduateProfileImage,
  type GraduateStoredUpload,
} from "@/lib/graduate-verification-storage";
import {
  sendGraduateAccountSetupEmail,
  sendGraduateVerificationResubmissionEmail,
} from "@/lib/graduate-verification-email";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { hasReservedMemberIdentifier } from "@/lib/member-identifier-reservations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type GraduateChallengeRow = {
  id: string;
  email_normalized: string;
  purpose: string;
  expires_at: string;
  verified_at: string | null;
};

type GraduateRequestRow = {
  id: string;
  status: string;
  certificate_storage_path: string | null;
  certificate_sha256: string | null;
  profile_image_id: string | null;
  resubmission_targets: string[] | null;
};

type GraduateImageRow = {
  id: string;
  storage_path: string;
};

type GraduateEmailMember = {
  id: string;
  display_name: string | null;
  graduate_verified_at: string | null;
};

export class GraduateVerificationServiceError extends Error {
  constructor(
    readonly code:
      | "application_session_required"
      | "upload_invalid"
      | "request_conflict"
      | "consent_required"
      | "submission_invalid",
    message: string,
  ) {
    super(message);
    this.name = "GraduateVerificationServiceError";
  }
}

export async function getVerifiedGraduateApplicationChallenge(challengeId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("graduate_email_challenges")
    .select("id,email_normalized,purpose,expires_at,verified_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const challenge = data as GraduateChallengeRow;
  if (
    challenge.purpose !== "application" ||
    !challenge.verified_at ||
    new Date(challenge.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }
  return challenge;
}

export async function findGraduateVerifiedMemberByEmail(emailNormalized: string) {
  const supabase = getSupabaseAdminClient();
  const { data: normalizedMember, error: normalizedMemberError } = await supabase
    .from("members")
    .select("id,display_name")
    .eq("email_normalized", emailNormalized)
    .is("deleted_at", null)
    .maybeSingle();
  if (normalizedMemberError) {
    return null;
  }
  if (normalizedMember?.id) {
    const { data: profile, error: profileError } = await supabase
      .from("graduate_profiles")
      .select("verified_at")
      .eq("member_id", normalizedMember.id)
      .maybeSingle();
    if (!profileError && profile?.verified_at) {
      return {
        id: normalizedMember.id as string,
        display_name: normalizedMember.display_name as string | null,
        graduate_verified_at: profile.verified_at as string,
      } satisfies GraduateEmailMember;
    }
  }

  // Temporary fallback while an old Preview database completes the backfill.
  const { data: identity, error: identityError } = await supabase
    .from("member_auth_identities")
    .select("member_id")
    .eq("provider", "graduate_email")
    .eq("identifier_normalized", emailNormalized)
    .maybeSingle();
  if (identityError || !identity?.member_id) {
    return null;
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id,display_name,graduate_verified_at")
    .eq("id", identity.member_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError || !member?.id || !member.graduate_verified_at) {
    return null;
  }
  return member as GraduateEmailMember;
}

export async function issueGraduatePasswordResetAction(input: {
  challengeId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("issue_graduate_password_reset", {
    p_challenge_id: input.challengeId,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt,
  });
  const memberId = typeof data === "string" ? data : null;
  if (error) {
    throw new Error("수료생 비밀번호 재설정 요청을 처리하지 못했습니다.");
  }
  if (!memberId) {
    return null;
  }

  const { data: member } = await supabase
    .from("members")
    .select("id,display_name")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!member?.id) {
    return null;
  }
  const { data: profile } = await supabase
    .from("graduate_profiles")
    .select("verified_at")
    .eq("member_id", member.id)
    .maybeSingle();
  if (!profile?.verified_at) {
    return null;
  }
  return {
    id: member.id as string,
    display_name: member.display_name as string | null,
    graduate_verified_at: profile.verified_at as string,
  } satisfies GraduateEmailMember;
}

async function requireGraduateApplicationUploads(input: {
  challengeId: string;
  certificateUploadId?: string | null;
  profileImageUploadId?: string | null;
}) {
  const [certificate, profileImage] = await Promise.all([
    input.certificateUploadId
      ? getGraduateVerificationUpload({
          challengeId: input.challengeId,
          uploadId: input.certificateUploadId,
          kind: "certificate",
        })
      : Promise.resolve(null),
    input.profileImageUploadId
      ? getGraduateVerificationUpload({
          challengeId: input.challengeId,
          uploadId: input.profileImageUploadId,
          kind: "profile_image",
        })
      : Promise.resolve(null),
  ]);
  if (
    (input.certificateUploadId && !certificate) ||
    (input.profileImageUploadId && !profileImage)
  ) {
    throw new GraduateVerificationServiceError(
      "upload_invalid",
      "업로드가 만료되었거나 확인할 수 없습니다. 파일을 다시 업로드해 주세요.",
    );
  }
  return { certificate, profileImage };
}

async function validateGraduateApplicationFiles(input: {
  certificate: GraduateStoredUpload | null;
  profileImage: GraduateStoredUpload | null;
}) {
  const certificateBuffer = input.certificate
    ? await downloadGraduateVerificationUpload(input.certificate)
    : null;
  const profileImageBuffer = input.profileImage
    ? await downloadGraduateVerificationUpload(input.profileImage)
    : null;

  if (input.certificate && certificateBuffer) {
    const certificateInspection = await inspectGraduateCertificatePdf(certificateBuffer);
    const certificateError = validateGraduateCertificateUpload({
      name: "completion.pdf",
      type: input.certificate.content_type,
      size: certificateBuffer.length,
      pageCount: certificateInspection.pageCount,
      hasPdfMagicBytes: certificateInspection.hasPdfMagicBytes,
      isEncrypted: certificateInspection.isEncrypted,
      hasJavaScript: certificateInspection.hasJavaScript,
      hasAttachments: certificateInspection.hasAttachments,
    });
    if (certificateError || !certificateInspection.isParseable) {
      throw new GraduateVerificationServiceError(
        "upload_invalid",
        certificateError ?? "올바른 PDF 파일인지 확인해 주세요.",
      );
    }
  }

  let normalizedProfileImage: Awaited<ReturnType<typeof normalizeGraduateProfileImage>> | null = null;
  if (input.profileImage && profileImageBuffer) {
    try {
      normalizedProfileImage = await normalizeGraduateProfileImage({
        contentType: input.profileImage.content_type,
        source: profileImageBuffer,
      });
    } catch (error) {
      throw new GraduateVerificationServiceError(
        "upload_invalid",
        error instanceof Error ? error.message : "본인 사진을 확인해 주세요.",
      );
    }
  }

  return {
    certificateBuffer,
    certificateSha256: certificateBuffer ? getGraduateFileSha256(certificateBuffer) : null,
    normalizedProfileImage,
  };
}

async function findOpenGraduateRequest(emailNormalized: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("graduate_verification_requests")
    .select("id,status,certificate_storage_path,certificate_sha256,profile_image_id,resubmission_targets")
    .eq("email_normalized", emailNormalized)
    .in("status", ["draft", "submitted", "in_review", "needs_resubmission"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error("수료생 인증 신청 상태를 확인하지 못했습니다.");
  }
  return (data ?? null) as GraduateRequestRow | null;
}

async function hasDuplicateGraduateCertificate(input: {
  certificateSha256: string;
  exceptRequestId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("graduate_verification_requests")
    .select("id")
    .eq("certificate_sha256", input.certificateSha256)
    .in("status", ["submitted", "in_review", "needs_resubmission", "approved"])
    .limit(1);

  if (input.exceptRequestId) {
    query = query.neq("id", input.exceptRequestId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error("수료증 중복 여부를 확인하지 못했습니다.");
  }
  return Boolean(data?.id);
}

async function markPreviousImageSuperseded(input: {
  profileImageId: string | null;
}) {
  if (!input.profileImageId) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_profile_images")
    .update({
      status: "superseded",
      delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", input.profileImageId)
    .select("id,storage_path")
    .maybeSingle();
  if (error) {
    throw new Error("기존 본인 사진을 갱신하지 못했습니다.");
  }
  return (data ?? null) as GraduateImageRow | null;
}

export async function submitGraduateVerificationRequest(input: {
  challengeId: string;
  certificateUploadId?: string | null;
  profileImageUploadId?: string | null;
  email: string;
  legalName: string;
  educationStartYear: number;
  educationStartMonth: number;
  educationEndYear: number;
  educationEndMonth: number;
  campus?: string | null;
  consented: boolean;
}) {
  if (!input.consented) {
    throw new GraduateVerificationServiceError(
      "consent_required",
      "개인정보와 본인 사진 이용에 동의해 주세요.",
    );
  }

  const challenge = await getVerifiedGraduateApplicationChallenge(input.challengeId);
  if (!challenge) {
    throw new GraduateVerificationServiceError(
      "application_session_required",
      "이메일 인증을 다시 진행해 주세요.",
    );
  }

  const submission = createGraduateVerificationSubmission(input);
  if (!submission.ok) {
    throw new GraduateVerificationServiceError("submission_invalid", submission.error);
  }
  if (submission.value.emailNormalized !== challenge.email_normalized) {
    throw new GraduateVerificationServiceError(
      "application_session_required",
      "인증한 이메일과 신청 이메일이 일치하지 않습니다.",
    );
  }

  const supabase = getSupabaseAdminClient();
  if (
    await hasReservedMemberIdentifier({
      emailNormalized: submission.value.emailNormalized,
    })
  ) {
    throw new GraduateVerificationServiceError(
      "request_conflict",
      "이미 사용 이력이 있는 이메일입니다. 로그인 또는 비밀번호 재설정을 이용해 주세요.",
    );
  }
  const { data: existingMember, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("email_normalized", submission.value.emailNormalized)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError) {
    throw new GraduateVerificationServiceError(
      "submission_invalid",
      "수료생 인증 신청 상태를 확인하지 못했습니다.",
    );
  }
  const { data: existingIdentity, error: identityError } = await supabase
    .from("member_auth_identities")
    .select("id")
    .eq("provider", "graduate_email")
    .eq("identifier_normalized", submission.value.emailNormalized)
    .maybeSingle();
  if (identityError) {
    throw new GraduateVerificationServiceError(
      "submission_invalid",
      "수료생 인증 신청 상태를 확인하지 못했습니다.",
    );
  }
  if (existingMember?.id || existingIdentity?.id) {
    throw new GraduateVerificationServiceError(
      "request_conflict",
      "이미 수료생 계정이 있는 이메일입니다. 로그인 또는 비밀번호 재설정을 이용해 주세요.",
    );
  }
  const existingRequest = await findOpenGraduateRequest(submission.value.emailNormalized);
  if (existingRequest && existingRequest.status !== "needs_resubmission") {
    throw new GraduateVerificationServiceError(
      "request_conflict",
      "이미 검토 중인 수료생 인증 신청이 있습니다.",
    );
  }

  const resubmissionTargets = existingRequest
    ? getGraduateResubmissionTargets(existingRequest.resubmission_targets ?? [])
    : null;
  const requirements = getGraduateSubmissionFileRequirements(resubmissionTargets);
  const requiresCertificate = requirements.certificate;
  const requiresProfileImage = requirements.profileImage;
  if (!requiresCertificate && input.certificateUploadId) {
    throw new GraduateVerificationServiceError(
      "upload_invalid",
      "요청된 보완 항목만 다시 업로드해 주세요.",
    );
  }
  if (!requiresProfileImage && input.profileImageUploadId) {
    throw new GraduateVerificationServiceError(
      "upload_invalid",
      "요청된 보완 항목만 다시 업로드해 주세요.",
    );
  }
  if (
    (requiresCertificate && !input.certificateUploadId) ||
    (requiresProfileImage && !input.profileImageUploadId)
  ) {
    throw new GraduateVerificationServiceError(
      "upload_invalid",
      "보완 요청된 파일을 모두 업로드해 주세요.",
    );
  }

  const uploads = await requireGraduateApplicationUploads({
    challengeId: input.challengeId,
    certificateUploadId: input.certificateUploadId,
    profileImageUploadId: input.profileImageUploadId,
  });
  const files = await validateGraduateApplicationFiles(uploads);
  if (
    (requiresCertificate && (!uploads.certificate || !files.certificateBuffer || !files.certificateSha256)) ||
    (requiresProfileImage && (!uploads.profileImage || !files.normalizedProfileImage))
  ) {
    throw new GraduateVerificationServiceError(
      "upload_invalid",
      "보완 요청된 파일을 확인할 수 없습니다. 다시 업로드해 주세요.",
    );
  }

  if (
    files.certificateSha256 &&
    await hasDuplicateGraduateCertificate({
      certificateSha256: files.certificateSha256,
      exceptRequestId: existingRequest?.id,
    })
  ) {
    throw new GraduateVerificationServiceError(
      "request_conflict",
      "이미 검토 중이거나 승인된 교육이수증입니다. 다른 수료증을 제출해 주세요.",
    );
  }

  const requestId = existingRequest?.id ?? randomUUID();
  let promotedCertificatePath: string | null = null;
  let storedProfileImagePath: string | null = null;
  let newProfileImageId: string | null = null;
  let createdRequest = false;
  let persistedRequest = false;

  try {
    if (uploads.certificate) {
      promotedCertificatePath = await promoteGraduateCertificate({
        upload: uploads.certificate,
        requestId,
      });
    }
    if (files.normalizedProfileImage) {
      if (!uploads.profileImage) {
        throw new GraduateVerificationServiceError(
          "upload_invalid",
          "본인 사진을 다시 업로드해 주세요.",
        );
      }
      await discardGraduateVerificationUpload(uploads.profileImage);
      storedProfileImagePath = await storeGraduateProfileImage({
        requestId,
        buffer: files.normalizedProfileImage.buffer,
      });
    }

    if (!existingRequest) {
      const { error } = await supabase.from("graduate_verification_requests").insert({
        id: requestId,
        email: submission.value.email,
        email_normalized: submission.value.emailNormalized,
        legal_name: submission.value.legalName,
        education_start_year: submission.value.educationStartYear,
        education_start_month: submission.value.educationStartMonth,
        education_end_year: submission.value.educationEndYear,
        education_end_month: submission.value.educationEndMonth,
        inferred_generation: submission.value.inferredGeneration,
        inferred_cohort: submission.value.inferredGeneration,
        cohort_rule_version: submission.value.cohortRuleVersion,
        campus: submission.value.campus,
        certificate_storage_path: promotedCertificatePath,
        certificate_sha256: files.certificateSha256,
        privacy_photo_consented_at: new Date().toISOString(),
        status: "submitted",
        submitted_at: new Date().toISOString(),
        resubmission_targets: [],
      });
      if (error) throw new Error("수료생 인증 신청을 저장하지 못했습니다.");
      createdRequest = true;
    }

    if (storedProfileImagePath && files.normalizedProfileImage) {
      const { data: image, error: imageError } = await supabase
        .from("member_profile_images")
        .insert({
          graduate_verification_request_id: requestId,
          storage_path: storedProfileImagePath,
          sha256: files.normalizedProfileImage.sha256,
          content_type: files.normalizedProfileImage.contentType,
          width: files.normalizedProfileImage.width,
          height: files.normalizedProfileImage.height,
          source: "graduate_verification",
          status: "pending",
        })
        .select("id")
        .single();
      if (imageError || !image?.id) {
        throw new Error("본인 사진 검토 정보를 저장하지 못했습니다.");
      }
      newProfileImageId = image.id;
    }

    if (!existingRequest) {
      const { error: updateError } = await supabase
        .from("graduate_verification_requests")
        .update({ profile_image_id: newProfileImageId })
        .eq("id", requestId);
      if (updateError || !newProfileImageId) {
        throw new Error("본인 사진 검토 정보를 연결하지 못했습니다.");
      }
      persistedRequest = true;
    } else {
      const { error } = await supabase
        .from("graduate_verification_requests")
        .update({
          email: submission.value.email,
          email_normalized: submission.value.emailNormalized,
          legal_name: submission.value.legalName,
          education_start_year: submission.value.educationStartYear,
          education_start_month: submission.value.educationStartMonth,
          education_end_year: submission.value.educationEndYear,
          education_end_month: submission.value.educationEndMonth,
          inferred_generation: submission.value.inferredGeneration,
          inferred_cohort: submission.value.inferredGeneration,
          cohort_rule_version: submission.value.cohortRuleVersion,
          campus: submission.value.campus,
          privacy_photo_consented_at: new Date().toISOString(),
          ...(promotedCertificatePath
            ? {
                certificate_storage_path: promotedCertificatePath,
                certificate_sha256: files.certificateSha256,
              }
            : {}),
          ...(newProfileImageId ? { profile_image_id: newProfileImageId } : {}),
          status: "submitted",
          submitted_at: new Date().toISOString(),
          review_note: null,
          rejection_reason: null,
          reviewed_at: null,
          decided_at: null,
          resubmission_targets: [],
      })
        .eq("id", requestId);
      if (error) throw new Error("수료생 인증 보완 제출을 저장하지 못했습니다.");
      persistedRequest = true;
    }

    if (existingRequest) {
      if (newProfileImageId) {
        await markPreviousImageSuperseded({
          profileImageId: existingRequest.profile_image_id,
        }).catch(() => undefined);
      }
      if (promotedCertificatePath && existingRequest.certificate_storage_path) {
        await removeGraduateStoredObject("graduate-certificates", existingRequest.certificate_storage_path).catch(() => undefined);
      }
    }

    const consumedUploadIds = [uploads.certificate?.id, uploads.profileImage?.id]
      .filter((value): value is string => Boolean(value));
    await markGraduateVerificationUploadsConsumed(consumedUploadIds).catch(() => undefined);
    return {
      requestId,
      status: "submitted" as const,
      inferredGeneration: submission.value.inferredGeneration,
    };
  } catch (error) {
    if (!persistedRequest && createdRequest) {
      try {
        await supabase
          .from("graduate_verification_requests")
          .delete()
          .eq("id", requestId);
      } catch {
        // The next review/cleanup pass can safely recover an incomplete request.
      }
    } else if (!persistedRequest && newProfileImageId) {
      try {
        await supabase
          .from("member_profile_images")
          .delete()
          .eq("id", newProfileImageId);
      } catch {
        // The image remains private and is eligible for a later cleanup pass.
      }
    }
    if (storedProfileImagePath) {
      await removeGraduateStoredObject("member-profile-images", storedProfileImagePath).catch(() => undefined);
    }
    if (promotedCertificatePath) {
      await removeGraduateStoredObject("graduate-certificates", promotedCertificatePath).catch(() => undefined);
    }
    if (error instanceof GraduateVerificationServiceError) throw error;
    throw new GraduateVerificationServiceError(
      "submission_invalid",
      "수료생 인증 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

export async function requestGraduateVerificationResubmission(input: {
  requestId: string;
  targets: readonly string[];
  adminId: string;
  note: string | null;
}) {
  const targets = getGraduateResubmissionTargets(input.targets);
  const note = input.note?.trim() || null;
  if (note && note.length > 500) {
    throw new Error("보완 요청 사유는 500자 이하로 입력해 주세요.");
  }
  await markGraduateVerificationInReview({
    requestId: input.requestId,
    adminId: input.adminId,
  });
  const supabase = getSupabaseAdminClient();
  const reviewerAdminProfileId = await getActiveReviewerAdminProfileId(input.adminId);
  const { data, error } = await supabase
    .from("graduate_verification_requests")
    .update({
      status: "needs_resubmission",
      resubmission_targets: targets,
      reviewer_admin_id: input.adminId,
      reviewer_admin_profile_id: reviewerAdminProfileId,
      review_note: note,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "in_review")
    .select("id,email,legal_name")
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error("보완 요청을 처리하지 못했습니다.");
  }
  const targetLabels: Record<GraduateResubmissionTarget, string> = {
    education_period: "교육 기간",
    certificate: "교육이수증",
    profile_image: "본인 사진",
  };
  try {
    await sendGraduateVerificationResubmissionEmail({
      to: data.email,
      displayName: data.legal_name,
      targets: targets.map((target) => targetLabels[target]),
      note,
    });
    await supabase
      .from("graduate_verification_requests")
      .update({
        resubmission_email_sent_at: new Date().toISOString(),
        resubmission_email_last_error_at: null,
      })
      .eq("id", data.id);
    return { targets, emailSent: true };
  } catch {
    await supabase
      .from("graduate_verification_requests")
      .update({ resubmission_email_last_error_at: new Date().toISOString() })
      .eq("id", data.id);
    return { targets, emailSent: false };
  }
}

export async function withdrawGraduateVerificationRequest(input: {
  challengeId: string;
}) {
  const challenge = await getVerifiedGraduateApplicationChallenge(input.challengeId);
  if (!challenge) {
    throw new GraduateVerificationServiceError(
      "application_session_required",
      "이메일 인증을 다시 진행해 주세요.",
    );
  }
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: request, error } = await supabase
    .from("graduate_verification_requests")
    .update({
      status: "withdrawn",
      resubmission_targets: [],
      certificate_delete_after: now,
      updated_at: now,
    })
    .eq("email_normalized", challenge.email_normalized)
    .in("status", ["draft", "submitted", "needs_resubmission"])
    .select("id,profile_image_id")
    .maybeSingle();
  if (error || !request?.id) {
    throw new GraduateVerificationServiceError(
      "request_conflict",
      "철회할 수 있는 수료생 인증 신청이 없습니다.",
    );
  }
  if (request.profile_image_id) {
    await supabase
      .from("member_profile_images")
      .update({
        status: "rejected",
        review_reason: "withdrawn_by_applicant",
        delete_after: now,
        updated_at: now,
      })
      .eq("id", request.profile_image_id)
      .eq("status", "pending");
  }
  return { requestId: request.id };
}

type GraduateApprovalRequest = {
  id: string;
  email: string;
  email_normalized: string;
  legal_name: string;
};

async function loadGraduateApprovalRequest(requestId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("graduate_verification_requests")
    .select("id,email,email_normalized,legal_name")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error("수료생 인증 신청을 찾을 수 없습니다.");
  }
  return data as GraduateApprovalRequest;
}

export async function approveGraduateVerificationRequest(input: {
  requestId: string;
  adminId: string;
  documentNumberHmac: string;
}) {
  await markGraduateVerificationInReview({
    requestId: input.requestId,
    adminId: input.adminId,
  });
  const request = await loadGraduateApprovalRequest(input.requestId);
  if (
    await hasReservedMemberIdentifier({
      emailNormalized: request.email_normalized,
    })
  ) {
    throw new Error("이미 사용 이력이 있는 이메일입니다.");
  }
  const setupToken = generateOpaqueToken();
  const { data, error } = await getSupabaseAdminClient().rpc(
    "approve_graduate_verification",
    {
      p_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_document_number_hmac: input.documentNumberHmac,
      p_setup_token_hash: hashOpaqueToken(setupToken),
      p_setup_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  );
  const memberId = typeof data === "string" ? data : null;
  if (error || !memberId) {
    throw new Error("수료생 인증 승인 조건을 확인해 주세요.");
  }

  try {
    await sendGraduateAccountSetupEmail({
      to: request.email,
      displayName: request.legal_name,
      token: setupToken,
    });
    await getSupabaseAdminClient()
      .from("graduate_verification_requests")
      .update({ setup_email_sent_at: new Date().toISOString(), setup_email_last_error_at: null })
      .eq("id", input.requestId);
    return { memberId, setupEmailSent: true };
  } catch {
    await getSupabaseAdminClient()
      .from("graduate_verification_requests")
      .update({ setup_email_last_error_at: new Date().toISOString() })
      .eq("id", input.requestId);
    return { memberId, setupEmailSent: false };
  }
}

export async function resendGraduateAccountSetupEmail(input: {
  requestId: string;
}) {
  const request = await loadGraduateApprovalRequest(input.requestId);
  const setupToken = generateOpaqueToken();
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reissue_graduate_initial_setup",
    {
      p_request_id: input.requestId,
      p_setup_token_hash: hashOpaqueToken(setupToken),
      p_setup_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  );
  const memberId = typeof data === "string" ? data : null;
  if (error || !memberId) {
    throw new Error("비밀번호 설정이 완료되지 않은 수료생 계정에만 메일을 다시 보낼 수 있습니다.");
  }

  try {
    await sendGraduateAccountSetupEmail({
      to: request.email,
      displayName: request.legal_name,
      token: setupToken,
    });
    await getSupabaseAdminClient()
      .from("graduate_verification_requests")
      .update({
        setup_email_sent_at: new Date().toISOString(),
        setup_email_last_error_at: null,
      })
      .eq("id", input.requestId);
    return { memberId, setupEmailSent: true };
  } catch {
    await getSupabaseAdminClient()
      .from("graduate_verification_requests")
      .update({ setup_email_last_error_at: new Date().toISOString() })
      .eq("id", input.requestId);
    return { memberId, setupEmailSent: false };
  }
}

async function getActiveReviewerAdminProfileId(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("admin_profiles")
    .select("id")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error("활성 관리자 프로필을 확인하지 못했습니다.");
  }
  return data.id as string;
}

export async function markGraduateVerificationInReview(input: {
  requestId: string;
  adminId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const reviewerAdminProfileId = await getActiveReviewerAdminProfileId(input.adminId);
  const { data, error } = await supabase
    .from("graduate_verification_requests")
    .update({
      status: "in_review",
      reviewer_admin_id: input.adminId,
      reviewer_admin_profile_id: reviewerAdminProfileId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error("검토 상태로 변경하지 못했습니다.");
  }
  if (data?.id) return;

  const { data: alreadyReviewing, error: lookupError } = await supabase
    .from("graduate_verification_requests")
    .select("id")
    .eq("id", input.requestId)
    .eq("status", "in_review")
    .maybeSingle();
  if (lookupError || !alreadyReviewing?.id) {
    throw new Error("검토 상태로 변경하지 못했습니다.");
  }
  await supabase
    .from("graduate_verification_requests")
    .update({
      reviewer_admin_id: input.adminId,
      reviewer_admin_profile_id: reviewerAdminProfileId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "in_review");
}

export async function rejectGraduateVerificationRequest(input: {
  requestId: string;
  adminId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) {
    throw new Error("반려 사유를 1~500자로 입력해 주세요.");
  }
  await markGraduateVerificationInReview({
    requestId: input.requestId,
    adminId: input.adminId,
  });
  const supabase = getSupabaseAdminClient();
  const reviewerAdminProfileId = await getActiveReviewerAdminProfileId(input.adminId);
  const { data: request, error: requestError } = await supabase
    .from("graduate_verification_requests")
    .update({
      status: "rejected",
      reviewer_admin_id: input.adminId,
      reviewer_admin_profile_id: reviewerAdminProfileId,
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      decided_at: new Date().toISOString(),
      certificate_delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "in_review")
    .select("profile_image_id")
    .maybeSingle();
  if (requestError || !request) {
    throw new Error("반려 처리할 수 없는 인증 신청입니다.");
  }
  if (request.profile_image_id) {
    await supabase
      .from("member_profile_images")
      .update({
        status: "rejected",
        reviewer_admin_id: input.adminId,
        reviewer_admin_profile_id: reviewerAdminProfileId,
        review_reason: reason,
        reviewed_at: new Date().toISOString(),
        delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", request.profile_image_id);
  }
}

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
  if (!reason || reason.length > 500) {
    throw new Error("반려 사유를 1~500자로 입력해 주세요.");
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
  if (!reason || reason.length > 500) {
    throw new Error("반려 사유는 1~500자로 입력해 주세요.");
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

export async function submitMemberProfileImageReplacement(input: {
  memberId: string;
  uploadId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("id", input.memberId)
    .maybeSingle();
  if (memberError || !member?.id) {
    throw new Error("회원 정보를 확인하지 못했습니다.");
  }
  const upload = await getGraduateMemberProfileReplacementUpload({
    uploadId: input.uploadId,
    memberId: input.memberId,
  });
  if (!upload) {
    throw new Error("사진 업로드가 만료되었거나 확인할 수 없습니다. 다시 선택해 주세요.");
  }
  const source = await downloadGraduateVerificationUpload(upload);
  const image = await normalizeGraduateProfileImage({
    contentType: upload.content_type,
    source,
  });
  // The signed-upload original is only a short-lived intake object. Keep the
  // normalized WebP below and discard the original as soon as decoding succeeds.
  await discardGraduateVerificationUpload(upload);
  const path = await storeGraduateProfileImage({
    requestId: `replacement-${input.memberId}`,
    buffer: image.buffer,
  });
  let profileImageId: string | null = null;
  try {
    await supabase
      .from("member_profile_images")
      .update({
        status: "superseded",
        delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("member_id", input.memberId)
      .is("graduate_verification_request_id", null)
      .eq("status", "pending");
    const { data, error } = await supabase
      .from("member_profile_images")
      .insert({
        member_id: input.memberId,
        storage_path: path,
        sha256: image.sha256,
        content_type: image.contentType,
        width: image.width,
        height: image.height,
        source: "member_upload",
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data?.id) throw new Error("본인 사진 변경 요청을 저장하지 못했습니다.");
    profileImageId = data.id;
    const { error: memberUpdateError } = await supabase
      .from("members")
      .update({
        profile_photo_review_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.memberId);
    if (memberUpdateError) {
      throw new Error("사진 변경 검토 상태를 저장하지 못했습니다.");
    }
    return { imageId: data.id };
  } catch (error) {
    if (profileImageId) {
      await supabase
        .from("member_profile_images")
        .delete()
        .eq("id", profileImageId)
        .eq("status", "pending");
    }
    await removeGraduateStoredObject("member-profile-images", path).catch(() => undefined);
    throw error;
  }
}

// Backward-compatible aliases while graduate verification actions move to the
// dedicated common profile-photo review surface.
export const approveGraduateProfileImageReplacement = approveMemberProfileImageReplacement;
export const rejectGraduateProfileImageReplacement = rejectMemberProfileImageReplacement;
export const submitGraduateProfileImageReplacement = submitMemberProfileImageReplacement;
