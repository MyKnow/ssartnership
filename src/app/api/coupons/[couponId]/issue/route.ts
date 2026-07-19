import { NextRequest, NextResponse } from "next/server";
import { adPackageRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";

function statusForReason(reason: string) {
  if (reason === "not_found") return 404;
  if (reason === "member_limit" || reason === "usage_limit" || reason === "code_unavailable") return 409;
  if (reason === "inactive") return 400;
  return 400;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> },
) {
  if (!isTrustedSameOriginRequest(request, { expectedOrigin: request.nextUrl.origin })) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const couponId = decodeURIComponent((await params).couponId ?? "").trim();
  if (!couponId || couponId.length > 128) {
    return NextResponse.json({ ok: false, message: "쿠폰 정보를 확인할 수 없습니다." }, { status: 400 });
  }
  try {
    const result = await adPackageRepository.issueCoupon({
      couponId,
      memberId: session.userId,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: statusForReason(result.reason) });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[coupon-issue] failed", error);
    return NextResponse.json({ ok: false, message: "쿠폰 다운로드에 실패했습니다." }, { status: 503 });
  }
}
