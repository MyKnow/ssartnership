import { NextResponse } from "next/server";
import { lookupNtsBusinessStatus } from "@/lib/nts-business-status";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import {
  PartnerPortalRouteBodyError,
  readPartnerPortalJsonBody,
} from "@/lib/partner-auth/route-body";
import { consumePartnerBusinessStatusLookupQuota } from "@/lib/partner-business-status-rate-limit";

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

  let body: Record<string, unknown>;
  try {
    body = await readPartnerPortalJsonBody<Record<string, unknown>>(request);
  } catch (error) {
    if (error instanceof PartnerPortalRouteBodyError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: "요청 본문 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

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

  const quota = await consumePartnerBusinessStatusLookupQuota({
    accountId: session.accountId,
    companyId,
  });
  if (!quota.ok) {
    if (quota.code === "blocked") {
      return NextResponse.json(
        { message: "사업자 상태조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { message: "사업자 상태조회를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }

  try {
    const result = await lookupNtsBusinessStatus(businessRegistrationNumber);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[partner-business-status] lookup failed", error);
    return NextResponse.json(
      { message: "사업자 상태조회를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
