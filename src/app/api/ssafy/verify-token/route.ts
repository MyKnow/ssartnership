import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSsafyVerifyServerConfig } from "@/lib/ssafy-verify/config";
import { findSsafyVerifiedMember } from "@/lib/ssafy-verify/member";
import { resolveSsafySignupProfile } from "@/lib/ssafy-verify/signup-profile";
import {
  clearSsafySignupSession,
  setSsafySignupSession,
} from "@/lib/ssafy-verify/signup-session";
import {
  exchangeSsafyVerificationCode,
  verifySsafyVerificationToken,
} from "@/lib/ssafy-verify/token";
import {
  parseSsafyVerifyCallbackBody,
  readJson,
} from "@/lib/ssafy-verify/schema";
import {
  buildSsafyVerifyRequestRedirectUri,
  resolveSsafyVerifyAllowedRedirectUris,
} from "@/lib/ssafy-verify/redirect";

export const runtime = "nodejs";

function publicError(
  errorCode: string,
  requestId: string | null,
  status = 400,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { ok: false, errorCode, requestId, ...extra },
    { status },
  );
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

    const requestRedirectUri = buildSsafyVerifyRequestRedirectUri(request);
    const parsedBody = parseSsafyVerifyCallbackBody(rawBody.value, {
      issuer: config.issuer,
      redirectUris: resolveSsafyVerifyAllowedRedirectUris(
        config,
        requestRedirectUri,
      ),
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
      sub: verified.claims.sub,
      mattermostUserId: verified.claims.mattermostUserId,
    });

    if (memberResult.ok || memberResult.errorCode === "SSAFY_MEMBER_CONFLICT") {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "blocked",
        actorType: memberResult.ok ? "member" : "guest",
        actorId: memberResult.ok ? memberResult.member.id : undefined,
        identifier: verified.claims.sub,
        properties: {
          reason: memberResult.ok ? "already_registered" : memberResult.errorCode,
          hasSession: Boolean(currentSession?.userId),
        },
      });
      await recordMemberAuthAttempt("ssafy-verify", verifiedThrottleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      await clearSsafySignupSession();
      return publicError("MEMBER_ALREADY_REGISTERED", null, 409, {
        redirectTo: "/auth/login",
      });
    }

    if (memberResult.errorCode === "MEMBER_LOOKUP_FAILED") {
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
      return publicError(memberResult.errorCode, null, 503);
    }

    const signupProfile = await resolveSsafySignupProfile({
      claims: verified.claims,
      verificationId: exchanged.verificationId,
      scope: exchanged.scope,
    });
    if (!signupProfile.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_ssafy_verify",
        status: "failure",
        actorType: "guest",
        identifier: verified.claims.sub,
        properties: {
          reason: signupProfile.errorCode,
          grantedScope: exchanged.scope,
          hasMattermostUserId: Boolean(verified.claims.mattermostUserId),
          hasCohort: Boolean(verified.claims.cohort),
          hasCampus: Boolean(verified.claims.campus),
          profileLookup: signupProfile.lookup,
          providerErrorCode: signupProfile.providerErrorCode ?? null,
          providerRequestId: signupProfile.requestId,
        },
      });
      await recordMemberAuthAttempt("ssafy-verify", verifiedThrottleContext, false);
      await delayMemberAuthAttempt("ssafy-verify");
      return publicError(
        signupProfile.errorCode,
        signupProfile.requestId,
        signupProfile.status,
      );
    }

    await setSsafySignupSession(signupProfile.session);
    await recordMemberAuthAttempt("ssafy-verify", verifiedThrottleContext, true);
    revalidatePath("/");
    revalidatePath("/auth/signup");
    revalidatePath("/auth/signup/complete");

    await logAuthSecurity({
      ...context,
      eventName: "member_ssafy_verify",
      status: "success",
      actorType: "guest",
      identifier: verified.claims.sub,
      properties: {
        cohort: verified.claims.cohort,
        campus: verified.claims.campus,
        hasMattermostUserId: Boolean(verified.claims.mattermostUserId),
        next: "signup_complete",
      },
    });

    return NextResponse.json({
      ok: true,
      verified: true,
      status: "signup_required",
      cohort:
        signupProfile.session.cohort === null
          ? null
          : String(signupProfile.session.cohort),
      campus: signupProfile.session.campus,
      authTime: verified.claims.authTime,
      requiresConsent: false,
      nextPath: "/auth/signup/complete",
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
