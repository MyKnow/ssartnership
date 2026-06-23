import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { issueResetPasswordCompletionToken } from "@/lib/reset-password-session";
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
import {
  buildSsafyVerifyRequestRedirectUri,
  resolveSsafyVerifyAllowedRedirectUris,
} from "@/lib/ssafy-verify/redirect";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";

export const runtime = "nodejs";

function publicError(errorCode: string, requestId: string | null, status = 400) {
  return NextResponse.json({ ok: false, errorCode, requestId }, { status });
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  const tokenTrace = createSsafyVerifyApiTraceLogger({
    ...context,
    actorType: "guest",
    properties: {
      flow: "member_password_reset_verify",
      route: "/api/ssafy/reset-password",
    },
  });
  const throttleContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: null,
  };

  try {
    const blockedState = await getMemberAuthBlockingState(
      "ssafy-reset-password",
      throttleContext,
    );
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset_ssafy",
        status: "blocked",
        actorType: "guest",
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
      await delayMemberAuthAttempt("ssafy-reset-password", true);
      return publicError("VERIFY_RATE_LIMITED", null, 429);
    }

    const config = getSsafyVerifyServerConfig();
    const rawBody = await readJson(request);
    if (!rawBody.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "guest",
        properties: { reason: "invalid_json" },
      });
      await recordMemberAuthAttempt("ssafy-reset-password", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-reset-password");
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
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "guest",
        properties: { reason: parsedBody.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-reset-password", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-reset-password");
      return publicError(parsedBody.errorCode, null, 400);
    }

    const exchanged = await exchangeSsafyVerificationCode(parsedBody.data, config, {
      trace: tokenTrace,
    });
    if (!exchanged.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "guest",
        identifier: exchanged.requestId,
        properties: { reason: exchanged.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-reset-password", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-reset-password");
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
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "guest",
        properties: { reason: verified.errorCode },
      });
      await recordMemberAuthAttempt("ssafy-reset-password", throttleContext, false);
      await delayMemberAuthAttempt("ssafy-reset-password");
      return publicError(verified.errorCode, null, 401);
    }

    const verifiedThrottleContext = {
      ...throttleContext,
      accountIdentifier: verified.claims.sub,
    };
    const subjectBlockedState = await getMemberAuthBlockingState(
      "ssafy-reset-password",
      verifiedThrottleContext,
    );
    if (subjectBlockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset_ssafy",
        status: "blocked",
        actorType: "guest",
        identifier: verified.claims.sub,
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(subjectBlockedState.identifier),
          blockedUntil: subjectBlockedState.blockedUntil,
        },
      });
      await delayMemberAuthAttempt("ssafy-reset-password", true);
      return publicError("VERIFY_RATE_LIMITED", null, 429);
    }

    const supabase = getSupabaseAdminClient();
    const memberResult = await findSsafyVerifiedMember(supabase, {
      sub: verified.claims.sub,
      mattermostUserId: verified.claims.mattermostUserId,
    });

    if (!memberResult.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "guest",
        identifier: verified.claims.sub,
        properties: { reason: memberResult.errorCode },
      });
      await recordMemberAuthAttempt(
        "ssafy-reset-password",
        verifiedThrottleContext,
        false,
      );
      await delayMemberAuthAttempt("ssafy-reset-password");
      const status =
        memberResult.errorCode === "SSAFY_MEMBER_CONFLICT"
          ? 409
          : memberResult.errorCode === "MEMBER_LOOKUP_FAILED"
            ? 503
            : 404;
      return publicError(memberResult.errorCode, null, status);
    }

    if (!memberResult.member.mm_user_id || !memberResult.member.mm_username) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "member",
        actorId: memberResult.member.id,
        identifier: verified.claims.sub,
        properties: { reason: "missing_mm_identity" },
      });
      await recordMemberAuthAttempt(
        "ssafy-reset-password",
        verifiedThrottleContext,
        false,
      );
      await delayMemberAuthAttempt("ssafy-reset-password");
      return publicError("MEMBER_NOT_FOUND", null, 404);
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
        eventName: "member_password_reset_ssafy",
        status: "failure",
        actorType: "member",
        actorId: memberResult.member.id,
        identifier: verified.claims.sub,
        properties: { reason: updateResult.errorCode },
      });
      return publicError(updateResult.errorCode, null, 500);
    }

    const completionToken = issueResetPasswordCompletionToken({
      memberId: memberResult.member.id,
      mmUserId: memberResult.member.mm_user_id,
      mmUsername: memberResult.member.mm_username,
      memberUpdatedAt: updateResult.payload.updated_at,
    });

    await recordMemberAuthAttempt(
      "ssafy-reset-password",
      verifiedThrottleContext,
      true,
    );
    revalidatePath("/auth/reset");
    revalidatePath("/auth/reset/complete");

    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset_ssafy",
      status: "success",
      actorType: "member",
      actorId: memberResult.member.id,
      identifier: verified.claims.sub,
      properties: {
        cohort: verified.claims.cohort,
        campus: verified.claims.campus,
        hasMattermostUserId: Boolean(verified.claims.mattermostUserId),
      },
    });

    return NextResponse.json({
      ok: true,
      verified: true,
      completionToken,
      mmUsername: memberResult.member.mm_username,
      authTime: verified.claims.authTime,
    });
  } catch {
    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset_ssafy",
      status: "failure",
      actorType: "guest",
      properties: { reason: "exception" },
    });
    await delayMemberAuthAttempt("ssafy-reset-password", true);
    return publicError("VERIFY_TOKEN_FAILED", null, 503);
  }
}
