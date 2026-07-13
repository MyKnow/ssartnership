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
import { sanitizeReturnTo } from "@/lib/return-to";
import { setUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hasReservedMemberIdentifier } from "@/lib/member-identifier-reservations";
import { findSsafyVerifiedMember } from "@/lib/ssafy-verify/member";
import {
  buildSsafySignupMemberInsertPayload,
  parseSsafySignupCompleteInput,
  persistSsafySignupMemberDomainRecords,
} from "@/lib/ssafy-verify/signup";
import {
  clearSsafySignupSession,
  getSsafySignupSession,
} from "@/lib/ssafy-verify/signup-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

function errorResponse(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "failure",
      actorType: "guest",
      properties: { reason: "same_origin_failed" },
    });
    return errorResponse("forbidden", 403);
  }

  const signupSession = await getSsafySignupSession();
  if (!signupSession) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "failure",
      actorType: "guest",
      properties: { reason: "signup_session_expired" },
    });
    return errorResponse("signup_session_expired", 401);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseSsafySignupCompleteInput(body);
    if (!parsed.ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: signupSession.sub,
        properties: {
          reason: "invalid_request",
          fieldNames: Object.keys(parsed.fieldErrors),
        },
      });
      return errorResponse("invalid_request", 400, {
        fieldErrors: parsed.fieldErrors,
      });
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
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: signupSession.sub,
        properties: {
          reason: "policy_outdated",
          message: policyError,
        },
      });
      return errorResponse("policy_outdated", 409, { message: policyError });
    }

    const supabase = getSupabaseAdminClient();
    const identifierReserved = await hasReservedMemberIdentifier({
      mmUserId: signupSession.mattermostUserId,
      mmUsername: signupSession.mattermostUsername,
      ssafySub: signupSession.sub,
    });
    if (identifierReserved) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "blocked",
        actorType: "guest",
        identifier: signupSession.sub,
        properties: { reason: "identifier_reserved" },
      });
      await clearSsafySignupSession();
      return errorResponse("already_registered", 409, {
        redirectTo: "/auth/login",
      });
    }
    const duplicate = await findSsafyVerifiedMember(supabase, {
      sub: signupSession.sub,
      mattermostUserId: signupSession.mattermostUserId,
    });
    if (duplicate.ok || duplicate.errorCode === "SSAFY_MEMBER_CONFLICT") {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "blocked",
        actorType: duplicate.ok ? "member" : "guest",
        actorId: duplicate.ok ? duplicate.member.id : null,
        identifier: signupSession.sub,
        properties: {
          reason: duplicate.ok ? "already_registered" : duplicate.errorCode,
          mattermostUserId: signupSession.mattermostUserId,
        },
      });
      await clearSsafySignupSession();
      return errorResponse("already_registered", 409, {
        redirectTo: "/auth/login",
      });
    }
    if (duplicate.errorCode === "MEMBER_LOOKUP_FAILED") {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: signupSession.sub,
        properties: {
          reason: "signup_lookup_failed",
          mattermostUserId: signupSession.mattermostUserId,
        },
      });
      return errorResponse("signup_lookup_failed", 503);
    }

    const agreedAt = new Date().toISOString();
    const passwordRecord = hashPassword(parsed.data.password);
    const payload = buildSsafySignupMemberInsertPayload({
      session: signupSession,
      passwordRecord,
      activePolicies,
      marketingPolicy,
      marketingPolicyChecked: parsed.data.marketingPolicyChecked,
      agreedAt,
    });

    const { data: insertedMember, error: insertError } = await supabase
      .from("members")
      .insert(payload)
      .select("id")
      .single();
    if (insertError || !insertedMember?.id) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: signupSession.sub,
        properties: { reason: "insert_failed" },
      });
      return errorResponse("signup_failed", 503);
    }

    try {
      await persistSsafySignupMemberDomainRecords(supabase, {
        memberId: insertedMember.id,
        session: signupSession,
        persistedAt: agreedAt,
      });
      await recordRequiredPolicyConsent({
        memberId: insertedMember.id,
        activePolicies,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
      await recordMarketingPolicyConsent({
        memberId: insertedMember.id,
        activePolicy: marketingPolicy,
        agreed: parsed.data.marketingPolicyChecked,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
    } catch {
      await supabase.from("members").delete().eq("id", insertedMember.id);
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "member",
        actorId: insertedMember.id,
        identifier: signupSession.sub,
        properties: {
          reason: "member_domain_or_consent_failed",
        },
      });
      return errorResponse("signup_failed", 503);
    }

    await setUserSession(insertedMember.id, false, {
      policyConsentSnapshot: {
        serviceVersion: activePolicies.service.version,
        privacyVersion: activePolicies.privacy.version,
      },
    });
    await clearSsafySignupSession();
    revalidatePath("/");
    revalidatePath("/auth/signup");
    revalidatePath("/auth/signup/complete");
    revalidatePath("/auth/consent");
    revalidatePath("/certification");

    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "success",
      actorType: "member",
      actorId: insertedMember.id,
      identifier: signupSession.sub,
      properties: {
        cohort: signupSession.cohort,
        campus: signupSession.campus,
        marketingPolicyChecked: parsed.data.marketingPolicyChecked,
      },
    });

    return NextResponse.json({
      ok: true,
      redirectTo: sanitizeReturnTo(
        typeof body?.returnTo === "string" ? body.returnTo : "",
        "/",
      ),
    });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "failure",
      actorType: "guest",
      identifier: signupSession.sub,
      properties: {
        reason: "exception",
        message: error instanceof Error ? error.message : null,
      },
    });
    return errorResponse("signup_failed", 503);
  }
}
