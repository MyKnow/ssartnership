import {
  getRequestLogContext,
  logAuthSecurity,
} from "@/lib/activity-logs";
import {
  getSelectedPolicyValidationError,
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { isValidPassword } from "@/lib/password";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";
import { parseVerifyCodeBody } from "./parsers";
import {
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  createMemberAuthThrottleContext,
  recordMemberAuthSuccess,
} from "./throttle";
import { mmErrorResponse, mmOkResponse } from "./responses";
import {
  clearVerificationState,
  getLatestVerificationCode,
  getVerificationAttempt,
  isVerificationAttemptBlocked,
  isVerificationCodeExpired,
  recordInvalidVerificationCodeAttempt,
} from "./verify-code-verification";
import { failVerifyCode, failVerifyCodeException } from "./verify-code-failure";
import { resolveVerifyCodeIdentity } from "./verify-code-identity";
import { finalizeVerifiedMember } from "./verify-code-member";

export const VERIFY_CODE_RUNTIME = "nodejs";

export async function handleVerifyCodePost(request: Request) {
  const context = getRequestLogContext(request);

  try {
    const payload = await parseVerifyCodeBody(request);
    const username = normalizeMmUsername(String(payload.username ?? ""));
    const code = String(payload.code ?? "").trim().toUpperCase();
    const password = String(payload.password ?? "").trim();
    const throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      username || null,
    );

    const blockedState = await getMemberAuthBlockedState(
      "verify-code",
      throttleContext,
    );
    if (blockedState) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "blocked",
        status: 429,
        reason: "rate_limit",
        identifier: username || null,
        recordFailure: false,
        blockedDelay: true,
        extra: {
          scope: getMemberAuthBlockedScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
    }

    if (!username || !code || !password) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
        identifier: username || null,
      });
    }

    if (validateMmUsername(username)) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_username",
        status: 400,
        reason: "invalid_username",
        identifier: username,
      });
    }

    if (!isValidPassword(password)) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_password",
        status: 400,
        reason: "invalid_password",
        identifier: username,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }

    if (!payload.servicePolicyId || !payload.privacyPolicyId) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "policy_required",
        status: 400,
        reason: "policy_required",
        identifier: username,
      });
    }

    const activePolicies = await getActiveRequiredPolicies();
    const activeMarketingPolicy = payload.marketingPolicyChecked
      ? await getPolicyDocumentByKind("marketing")
      : null;
    const policyValidationError = getSelectedPolicyValidationError(
      {
        servicePolicyId: payload.servicePolicyId,
        privacyPolicyId: payload.privacyPolicyId,
        marketingPolicyId: payload.marketingPolicyId,
        marketingPolicyChecked: payload.marketingPolicyChecked,
      },
      activePolicies,
      activeMarketingPolicy,
    );
    if (policyValidationError) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "policy_outdated" },
      });
      return mmErrorResponse("policy_outdated", 409, policyValidationError);
    }

    const identity = await resolveVerifyCodeIdentity(username);
    if (identity.kind === "inaccessible") {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "team_or_channel_inaccessible",
        identifier: username,
        extra: {
          status: identity.status,
        },
      });
    }
    if (identity.kind === "not-found") {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "not_mm",
        identifier: username,
      });
    }

    const {
      directoryEntry,
      resolvedStudent,
      mmUserId,
      resolvedDisplayName,
      resolvedCampus,
    } = identity;

    const attempt = await getVerificationAttempt(mmUserId);
    if (isVerificationAttemptBlocked(attempt)) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "blocked",
        status: 429,
        reason: "verification_blocked",
        identifier: mmUserId,
        blockedDelay: true,
      });
    }

    const codeRow = await getLatestVerificationCode(mmUserId);
    if (!codeRow) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "missing_code",
        identifier: mmUserId,
      });
    }

    if (isVerificationCodeExpired(codeRow)) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "expired",
        status: 400,
        reason: "expired",
        identifier: mmUserId,
      });
    }

    const verificationResult = await recordInvalidVerificationCodeAttempt(
      mmUserId,
      attempt,
      code,
      codeRow,
    );

    if (!verificationResult.matched) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "invalid_code",
        identifier: mmUserId,
        blockedDelay: Boolean(verificationResult.blockedUntil),
        extra: {
          attemptCount: verificationResult.nextCount,
        },
      });
    }

    const finalizeResult = await finalizeVerifiedMember({
      context,
      mmUserId,
      directoryEntry,
      resolvedStudent,
      resolvedDisplayName,
      resolvedCampus,
      password,
      codeYear: codeRow.year,
      activePolicies,
      marketingPolicy: activeMarketingPolicy,
      marketingPolicyAgreed: Boolean(payload.marketingPolicyChecked),
    });

    if (finalizeResult.kind === "error") {
      if (finalizeResult.error === "sender_unavailable") {
        return failVerifyCode({
          context,
          throttleContext,
          error: "verify_failed",
          status: 503,
          reason: "sender_unavailable",
          identifier: mmUserId,
          recordFailure: false,
          message: finalizeResult.message,
        });
      }
      return failVerifyCode({
        context,
        throttleContext,
        error: "verify_failed",
        status: 503,
        reason: "member_creation_failed",
        identifier: mmUserId,
        recordFailure: false,
        message: finalizeResult.message,
      });
    }

    await clearVerificationState(mmUserId);
    await recordMemberAuthSuccess("verify-code", throttleContext);

    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "success",
      actorType: "member",
      actorId: finalizeResult.authenticatedMemberId,
      identifier: mmUserId,
      properties: {
        year: finalizeResult.nextYear ?? codeRow.year ?? null,
        campus: finalizeResult.campus,
        existingMember: finalizeResult.existingMember,
        mmUsername: finalizeResult.mmUsername,
        mmUserId,
      },
    });

    return mmOkResponse();
  } catch (error) {
    return failVerifyCodeException(request, error);
  }
}
