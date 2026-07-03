import { NextResponse } from "next/server";
import { lookupNtsBusinessStatus } from "@/lib/nts-business-status";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getPartnerSession();
  if (!session || session.mustChangePassword) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const businessRegistrationNumber =
    typeof body.businessRegistrationNumber === "string"
      ? body.businessRegistrationNumber.trim()
      : "";
  if (!companyId || !isPartnerPortalCompanyAllowed(session, companyId)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  if (!businessRegistrationNumber) {
    return NextResponse.json(
      { message: "사업자등록번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await lookupNtsBusinessStatus(businessRegistrationNumber);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "사업자등록번호를 확인해 주세요.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
