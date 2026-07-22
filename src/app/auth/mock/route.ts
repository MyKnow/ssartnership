import { NextRequest, NextResponse } from "next/server";
import { getMemberRequiredGateRedirect } from "@/lib/member-required-gates";
import {
  MOCK_MEMBER_ID,
  isMockMemberAuthEnabled,
} from "@/lib/mock/member";
import { sanitizeReturnTo } from "@/lib/return-to";
import { getUserSession, setUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isMockMemberAuthEnabled()) {
    return NextResponse.json(
      { error: "mock_auth_disabled" },
      { status: 404 },
    );
  }

  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
    "/",
  );

  await setUserSession(MOCK_MEMBER_ID, false, {
    persistent: false,
    authenticationMethod: "manual",
    freshAuthentication: true,
    policyConsentSnapshot: null,
  });

  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "mock_session_failed" },
      { status: 503 },
    );
  }

  const gateRedirect = getMemberRequiredGateRedirect({
    currentPath: "/auth/mock",
    returnTo,
    mustChangePassword: session.mustChangePassword,
    requiresConsent: session.requiresConsent,
    requiresProfilePhotoUpdate: session.requiresProfilePhotoUpdate,
  });

  return NextResponse.redirect(
    new URL(gateRedirect ?? returnTo, request.url),
  );
}
