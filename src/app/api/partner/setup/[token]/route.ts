import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  completePartnerPortalInitialSetup,
  getPartnerPortalSetupContext,
  getPartnerPortalSetupErrorStatus,
  isPartnerPortalSetupError,
} from "@/lib/partner-auth";
import { PartnerPortalRouteBodyError, readPartnerPortalJsonBody } from "@/lib/partner-auth/route-body";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_PARTNER_SETUP_JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function partnerSetupJson(
  body: Record<string, unknown>,
  init: Omit<ResponseInit, "headers"> = {},
) {
  return NextResponse.json(body, {
    ...init,
    headers: PRIVATE_PARTNER_SETUP_JSON_HEADERS,
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const setupContext = await getPartnerPortalSetupContext(token);
  if (!setupContext) {
    return partnerSetupJson({ error: "not_found" }, { status: 404 });
  }
  return partnerSetupJson({ ok: true, context: setupContext });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return partnerSetupJson({ error: "forbidden" }, { status: 403 });
  }

  const { token } = await context.params;

  try {
    const payload = await readPartnerPortalJsonBody<{
      password?: string;
      confirmPassword?: string;
    }>(request);

    const result = await completePartnerPortalInitialSetup({
      token,
      password: String(payload.password ?? ""),
      confirmPassword: String(payload.confirmPassword ?? ""),
    });

    await logAuthSecurity({
      ...getRequestLogContext(request),
      eventName: "partner_initial_setup",
      status: "success",
      actorType: "partner",
      actorId: result.accountId,
      identifier: result.loginId,
      properties: {
        companyId: result.companyId,
      },
    });

    return partnerSetupJson({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PartnerPortalRouteBodyError) {
      await logAuthSecurity({
        ...getRequestLogContext(request),
        eventName: "partner_initial_setup",
        status: "failure",
        actorType: "guest",
        properties: {
          reason: "invalid_body",
        },
      });
      return partnerSetupJson(
        {
          error: "invalid_body",
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (isPartnerPortalSetupError(error)) {
      await logAuthSecurity({
        ...getRequestLogContext(request),
        eventName: "partner_initial_setup",
        status: "failure",
        actorType: "guest",
        properties: {
          reason: error.code,
        },
      });
      return partnerSetupJson(
        {
          error: error.code,
          message: error.message,
        },
        {
          status: getPartnerPortalSetupErrorStatus(error.code),
        },
      );
    }

    console.error("[partner-setup-route] unexpected setup failure", {
      route: "/api/partner/setup/[token]",
      requestId:
        request.headers.get("x-vercel-id") ??
        request.headers.get("x-request-id") ??
        null,
      reasonCode: "unexpected_setup_failure",
    });

    await logAuthSecurity({
      ...getRequestLogContext(request),
      eventName: "partner_initial_setup",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
      },
    });

    return partnerSetupJson(
      {
        error: "setup_failed",
        message: "초기 설정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
