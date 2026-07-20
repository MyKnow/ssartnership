import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
  getSelectedPolicyValidationError,
  recordMarketingPolicyConsent,
  recordRequiredPolicyConsent,
} from "@/lib/policy-documents";
import { hashPassword } from "@/lib/password";
import {
  getMattermostCodeSession,
  clearMattermostCodeSession,
} from "@/lib/mattermost-code-session";
import {
  classifyMattermostSignupProfile,
  getMattermostSignupDisplayName,
} from "@/lib/mm-signup-approval";
import { createMattermostSignupApprovalRequest } from "@/lib/mm-signup-approval/repository";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { findMmUserDirectoryEntryByUserId, upsertMmUserDirectorySnapshot } from "@/lib/mm-directory";
import { hasExistingMattermostMember } from "@/lib/member-identifier-reservations";
import { isMattermostLoginDisabledForGeneration } from "@/lib/member-email-login-transition";
import { parseMemberSignupCompleteInput } from "@/lib/member-signup";
import { sanitizeReturnTo } from "@/lib/return-to";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession, UserSessionIssueError } from "@/lib/user-auth";
import { attachMattermostSignupProfileImage } from "@/lib/member-signup-profile";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";

export const runtime = "nodejs";

function errorResponse(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function getSignupFailureReason(error: unknown) {
  if (error instanceof UserSessionIssueError) {
    return error.code;
  }
  const message = error instanceof Error ? error.message : "";
  return /^[a-z0-9][a-z0-9_:-]{0,80}$/.test(message)
    ? message
    : "signup_failed";
}

async function discardSignupProfileUpload(input: {
  uploadId: string | null;
  ownerId: string | undefined;
}) {
  if (!input.uploadId || !input.ownerId) return;
  await getImageUploadRepository().discard({
    actor: { kind: "signup", id: input.ownerId },
    purpose: "member-signup-profile",
    uploadId: input.uploadId,
  }).catch(() => undefined);
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return errorResponse("forbidden", 403);
  }
  const verification = await getMattermostCodeSession("signup");
  if (!verification) {
    return errorResponse("verification_expired", 401);
  }
  const body = await request.json().catch(() => null);
  const parsed = parseMemberSignupCompleteInput(body);
  if (!parsed.ok) {
    return errorResponse("invalid_request", 400, { fieldErrors: parsed.fieldErrors });
  }
  if (parsed.data.profileImageUploadId && !verification.signupUploadOwnerId) {
    return errorResponse("verification_expired", 401);
  }

  const [activePolicies, marketingPolicy] = await Promise.all([
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing"),
  ]);
  const policyError = getSelectedPolicyValidationError(
    parsed.data,
    activePolicies,
    marketingPolicy,
  );
  if (policyError) {
    return errorResponse("policy_outdated", 409, { message: policyError });
  }

  try {
    const user = await withActiveMattermostSenderForGeneration(
      verification.senderGeneration,
      (session) => session.getUserById(verification.mmUserId),
    );
    if (user.id !== verification.mmUserId || user.deleteAt > 0) {
      await discardSignupProfileUpload({
        uploadId: parsed.data.profileImageUploadId,
        ownerId: verification.signupUploadOwnerId,
      });
      await clearMattermostCodeSession();
      return errorResponse("verification_expired", 401);
    }
    const profileInput = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    const profileClassification = classifyMattermostSignupProfile(profileInput);
    const displayName = getMattermostSignupDisplayName(
      profileInput,
      profileClassification.profile,
    ).trim();
    const approvalMode = verification.signupMode === "approval"
      || profileClassification.mode === "approval";
    if (
      verification.subjectGeneration > 0
      && await isMattermostLoginDisabledForGeneration(verification.subjectGeneration)
    ) {
      await discardSignupProfileUpload({
        uploadId: parsed.data.profileImageUploadId,
        ownerId: verification.signupUploadOwnerId,
      });
      await clearMattermostCodeSession();
      return errorResponse("generation_completed", 409);
    }

    const isStaff = verification.subjectGeneration === 0;
    const sourceYears = [
      isStaff ? verification.senderGeneration : verification.subjectGeneration,
    ];
    await upsertMmUserDirectorySnapshot({
      mmUserId: user.id,
      mmUsername: user.username,
      displayName,
      campus: null,
      isStaff,
      sourceYears,
    });
    const directory = await findMmUserDirectoryEntryByUserId(user.id);
    if (!directory?.id) {
      throw new Error("directory_missing");
    }

    if (await hasExistingMattermostMember({ mmUserId: user.id, mmUsername: user.username })) {
      await discardSignupProfileUpload({
        uploadId: parsed.data.profileImageUploadId,
        ownerId: verification.signupUploadOwnerId,
      });
      await clearMattermostCodeSession();
      return errorResponse("already_registered", 409, { redirectTo: "/auth/login" });
    }

    const supabase = getSupabaseAdminClient();
    const password = hashPassword(parsed.data.password);
    if (approvalMode) {
      const approvalRequest = await createMattermostSignupApprovalRequest({
        mmUserId: user.id,
        mattermostAccountId: directory.id,
        mmUsername: user.username,
        mattermostDisplayName: displayName,
        senderGeneration: verification.senderGeneration,
        requestedGeneration: verification.subjectGeneration,
        parseExclusionReason:
          verification.parseExclusionReason ?? profileClassification.parseReason,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        servicePolicy: activePolicies.service,
        privacyPolicy: activePolicies.privacy,
        marketingPolicy,
        marketingPolicyChecked: parsed.data.marketingPolicyChecked,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        profileImageUploadId: parsed.data.profileImageUploadId,
        signupUploadOwnerId: verification.signupUploadOwnerId,
      });
      await clearMattermostCodeSession();
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_approval_request",
        status: "success",
        actorType: "guest",
        properties: {
          generation: verification.subjectGeneration,
          parseReason:
            verification.parseExclusionReason ?? profileClassification.parseReason,
          status: approvalRequest.status,
        },
      });
      return NextResponse.json({
        ok: true,
        redirectTo: "/auth/signup/pending",
      });
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("members")
      .insert({
        mattermost_account_id: directory.id,
        display_name: displayName,
        generation: verification.subjectGeneration,
        staff_source_generation: isStaff ? verification.senderGeneration : null,
        campus: null,
        password_hash: password.hash,
        password_salt: password.salt,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insertError || !inserted?.id) throw insertError ?? new Error("member_insert_failed");

    try {
      if (parsed.data.profileImageUploadId) {
        if (!verification.signupUploadOwnerId) {
          throw new Error("signup_upload_owner_missing");
        }
        await attachMattermostSignupProfileImage({
          memberId: inserted.id,
          uploadId: parsed.data.profileImageUploadId,
          signupUploadOwnerId: verification.signupUploadOwnerId,
        });
      }
      await recordRequiredPolicyConsent({
        memberId: inserted.id,
        activePolicies,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
      await recordMarketingPolicyConsent({
        memberId: inserted.id,
        activePolicy: marketingPolicy,
        agreed: parsed.data.marketingPolicyChecked,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
      await setUserSession(inserted.id, false, {
        authenticationMethod: "mattermost",
        freshAuthentication: true,
      });
    } catch (error) {
      await discardSignupProfileUpload({
        uploadId: parsed.data.profileImageUploadId,
        ownerId: verification.signupUploadOwnerId,
      });
      await supabase.from("members").delete().eq("id", inserted.id);
      throw error;
    }

    await clearMattermostCodeSession();
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "success",
      actorType: "member",
      actorId: inserted.id,
      properties: { source: "mattermost_code", generation: verification.subjectGeneration },
    });
    revalidatePath("/");
    return NextResponse.json({ ok: true, redirectTo: sanitizeReturnTo(
      typeof body === "object" && body && !Array.isArray(body)
        ? (body as Record<string, unknown>).returnTo as string | undefined
        : undefined,
      "/",
    ) });
  } catch (error) {
    const reason = getSignupFailureReason(error);
    console.error("[mm/signup] signup_failed", {
      requestId: context.requestId,
      reason,
      message: error instanceof Error ? error.message.slice(0, 240) : "unknown_error",
    });
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "failure",
      actorType: "guest",
      properties: {
        source: "mattermost_code",
        reason,
      },
    });
    return errorResponse("signup_failed", 503);
  }
}
