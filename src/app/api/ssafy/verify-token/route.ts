import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getMemberRequiredPolicyStatus } from "@/lib/policy-documents";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { getSignedUserSession, setUserSession } from "@/lib/user-auth";
import { getSsafyVerifyServerConfig } from "@/lib/ssafy-verify/config";
import {
  findSsafyVerifiedMember,
  updateMemberSsafyVerification,
} from "@/lib/ssafy-verify/member";
import {
  exchangeSsafyVerificationCode,
  verifySsafyVerificationToken,
} from "@/lib/ssafy-verify/token";
import {
  parseSsafyVerifyCallbackBody,
  readJson,
} from "@/lib/ssafy-verify/schema";

export const runtime = "nodejs";

function publicError(errorCode: string, requestId: string | null, status = 400) {
  return NextResponse.json({ ok: false, errorCode, requestId }, { status });
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  const throttleContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: null,
  };

  try {
    const blockedState = await getMemberAuthBlockingState(
      "ssafy-verify",
      throttleContext,
    );
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "blocked",
        actorType: "guest",
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
      await delayMemberAuthAttempt("ssafy-verify", true);
      return publicError("VERIFY_RATE_LIMITED", null, 429);
    }

    const config = getSsafyVerifyServerConfig();
    const rawBody = await readJson(request);
    if (!rawBody.ok) {
      await recordMemberAuthAttempt("ssafy-verify", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      return publicError("INVALID_REQUEST", null, 400);
    }

    const parsedBody = parseSsafyVerifyCallbackBody(rawBody.value, {
      issuer: config.issuer,
      redirectUri: config.redirectUri,
    });
    if (!parsedBody.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "failure",
        actorType: "guest",
        properties: { reason: parsedBody.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-verify", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      return publicError(parsedBody.errorCode, null, 400);
    }

    const exchanged = await exchangeSsafyVerificationCode(parsedBody.data, config);
    if (!exchanged.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "failure",
        actorType: "guest",
        identifier: exchanged.requestId,
        properties: { reason: exchanged.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-verify", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      return publicError(
        exchanged.errorCode,
        exchanged.requestId,
        exchanged.status,
      );
    }

    const verified = await verifySsafyVerificationToken(
      exchanged.verificationToken,
      config,
    );
    if (!verified.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "failure",
        actorType: "guest",
        properties: { reason: verified.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-verify", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      return publicError(verified.errorCode, null, 401);
    }

    const verifiedThrottleContext = {
      ...throttleContext,
      accountIdentifier: verified.claims.sub,
    };
    const subjectBlockedState = await getMemberAuthBlockingState(
      "ssafy-verify",
      verifiedThrottleContext,
    );
    if (subjectBlockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "blocked",
        actorType: "guest",
        identifier: verified.claims.sub,
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(subjectBlockedState.identifier),
          blockedUntil: subjectBlockedState.blockedUntil,
        },
      });
      await delayMemberAuthAttempt("ssafy-verify", true);
      return publicError("VERIFY_RATE_LIMITED", null, 429);
    }

    const currentSession = await getSignedUserSession();
    const supabase = getSupabaseAdminClient();
    const memberResult = await findSsafyVerifiedMember(supabase, {
      currentMemberId: currentSession?.userId ?? null,
      sub: verified.claims.sub,
      mattermostUserId: verified.claims.mattermostUserId,
    });

    if (!memberResult.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "failure",
        actorType: "guest",
        identifier: verified.claims.sub,
        properties: { reason: memberResult.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-verify", verifiedThrottleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      const status =
        memberResult.errorCode === "SSAFY_MEMBER_CONFLICT"
          ? 409
          : memberResult.errorCode === "MEMBER_LOOKUP_FAILED"
            ? 503
            : 404;
      return publicError(memberResult.errorCode, null, status);
    }

    const updateResult = await updateMemberSsafyVerification(
      supabase,
      memberResult.member.id,
      {
        ...verified.claims,
        verificationId: exchanged.verificationId,
        scope: exchanged.scope,
      },
    );
    if (!updateResult.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "failure",
        actorType: "member",
        actorId: memberResult.member.id,
        identifier: verified.claims.sub,
        properties: { reason: updateResult.errorCode },
      });
      return publicError(updateResult.errorCode, null, 500);
    }

    const policyStatus = await getMemberRequiredPolicyStatus(memberResult.member.id);
    await setUserSession(
      memberResult.member.id,
      Boolean(memberResult.member.must_change_password),
    );
    await recordMemberAuthAttempt("ssafy-verify", verifiedThrottleContext, true);
    revalidatePath("/");
    revalidatePath("/auth/consent");
    revalidatePath("/auth/change-password");
    revalidatePath("/certification");

    await logAuthSecurity({
      ...context,
      eventName: "member_ssafy_verify",
      status: "success",
      actorType: "member",
      actorId: memberResult.member.id,
      identifier: verified.claims.sub,
      properties: {
        cohort: verified.claims.cohort,
        campus: verified.claims.campus,
        hasMattermostUserId: Boolean(verified.claims.mattermostUserId),
        requiresConsent: policyStatus.requiresConsent,
      },
    });

    return NextResponse.json({
      ok: true,
      verified: true,
      cohort: verified.claims.cohort,
      campus: verified.claims.campus,
      authTime: verified.claims.authTime,
      requiresConsent: policyStatus.requiresConsent,
    });
  } catch {
    await logAuthSecurity({
      ...context,
      eventName: "member_ssafy_verify",
      status: "failure",
      actorType: "guest",
      properties: { reason: "exception" },
    });
    await delayMemberAuthAttempt("ssafy-verify", true);
    return publicError("VERIFY_TOKEN_FAILED", null, 503);
  }
}
