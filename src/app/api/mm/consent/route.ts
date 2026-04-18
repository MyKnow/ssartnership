import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getUserSession, setUserSession } from "@/lib/user-auth";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
  getSelectedPolicyValidationError,
  recordMarketingPolicyConsent,
  recordRequiredPolicyConsent,
} from "@/lib/policy-documents";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  try {
    const session = await getUserSession();
    if (!session?.userId) {
      await logAuthSecurity({
        ...context,
        eventName: "member_policy_consent",
        status: "failure",
        actorType: "guest",
        properties: { reason: "unauthorized" },
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as {
      servicePolicyId?: string;
      privacyPolicyId?: string;
      marketingPolicyId?: string | null;
      marketingPolicyChecked?: boolean;
    };

    if (!payload.servicePolicyId || !payload.privacyPolicyId) {
      await logAuthSecurity({
        ...context,
        eventName: "member_policy_consent",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { reason: "missing_fields" },
      });
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const activePolicies = await getActiveRequiredPolicies();
    const activeMarketingPolicy = payload.marketingPolicyChecked
      ? await getPolicyDocumentByKind("marketing")
      : null;
    const validationError = getSelectedPolicyValidationError(
      payload,
      activePolicies,
      activeMarketingPolicy,
    );
    if (validationError) {
      await logAuthSecurity({
        ...context,
        eventName: "member_policy_consent",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { reason: "policy_outdated" },
      });
      return NextResponse.json(
        { error: "policy_outdated", message: validationError },
        { status: 409 },
      );
    }

    const agreedAt = await recordRequiredPolicyConsent({
      memberId: session.userId,
      activePolicies,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    const marketingAgreedAt = await recordMarketingPolicyConsent({
      memberId: session.userId,
      activePolicy: activeMarketingPolicy,
      agreed: Boolean(payload.marketingPolicyChecked),
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    await logAuthSecurity({
      ...context,
      eventName: "member_policy_consent",
      status: "success",
      actorType: "member",
      actorId: session.userId,
      properties: {
        serviceVersion: activePolicies.service.version,
        privacyVersion: activePolicies.privacy.version,
        marketingVersion: activeMarketingPolicy?.version ?? null,
        marketingChecked: Boolean(payload.marketingPolicyChecked),
      },
    });

    await setUserSession(session.userId, Boolean(session.mustChangePassword), {
      policyConsentSnapshot: {
        serviceVersion: activePolicies.service.version,
        privacyVersion: activePolicies.privacy.version,
      },
    });

    return NextResponse.json({
      ok: true,
      agreedAt,
      marketingAgreedAt,
      redirectTo: session.mustChangePassword ? "/auth/change-password" : "/",
    });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_policy_consent",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    return NextResponse.json(
      {
        error: "consent_failed",
        message: "약관 동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
