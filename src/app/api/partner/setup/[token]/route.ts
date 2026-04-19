import { NextRequest, NextResponse } from "next/server";
import {
  completePartnerPortalInitialSetup,
  getPartnerPortalSetupContext,
  getPartnerPortalSetupErrorStatus,
  isPartnerPortalSetupError,
} from "@/lib/partner-auth";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const setupContext = await getPartnerPortalSetupContext(token);
  if (!setupContext) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, context: setupContext });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { token } = await context.params;

  try {
    const payload = (await request.json()) as {
      password?: string;
      confirmPassword?: string;
    };

    const result = await completePartnerPortalInitialSetup({
      token,
      password: String(payload.password ?? ""),
      confirmPassword: String(payload.confirmPassword ?? ""),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (isPartnerPortalSetupError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        {
          status: getPartnerPortalSetupErrorStatus(error.code),
        },
      );
    }

    return NextResponse.json(
      {
        error: "setup_failed",
        message: "초기 설정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
