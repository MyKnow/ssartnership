import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { consumeProductEventQuota } from "@/lib/product-event-throttle";
import { adPackageRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

type RedeemRequestBody = {
  sessionId?: string | null;
};

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return "";
  }
}

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 128) : null;
}

function statusForReason(reason: string) {
  switch (reason) {
    case "not_found":
      return 404;
    case "member_limit":
    case "usage_limit":
    case "onsite_verification_required":
      return 409;
    case "inactive":
    case "invalid":
      return 400;
    default:
      return 400;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const resolvedParams = await params;
  const couponId = resolvedParams?.couponId
    ? safeDecodeSegment(resolvedParams.couponId)
    : "";
  if (!couponId) {
    return NextResponse.json(
      { ok: false, message: "쿠폰 정보를 확인할 수 없습니다." },
      { status: 400 },
    );
  }

  let body: RedeemRequestBody | null;
  try {
    body = (await request.json()) as RedeemRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const context = getRequestLogContext(request);
  const sessionId = normalizeSessionId(body?.sessionId);
  if (
    !consumeProductEventQuota({
      eventName: "coupon_redeem",
      ipAddress: context.ipAddress,
      sessionId,
    })
  ) {
    return NextResponse.json(
      { ok: false, message: "요청이 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  try {
    const result = await adPackageRepository.redeemCoupon({
      couponId,
      memberId: session.userId,
      sessionId,
      metadata: {
        path: context.path,
        userAgent: context.userAgent,
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          message: result.message,
          coupon: result.coupon ?? null,
        },
        { status: statusForReason(result.reason) },
      );
    }

    scheduleProductEventLog({
      ...context,
      actorType: "member",
      actorId: session.userId,
      sessionId,
      eventName: "coupon_redeem",
      targetType: "ad_coupon",
      targetId: result.coupon.id,
      properties: {
        campaignId: result.coupon.campaignId,
        partnerId: result.coupon.partnerId,
        redemptionId: result.redemption.id,
      },
    });

    return NextResponse.json({
      ok: true,
      coupon: result.coupon,
      redemption: result.redemption,
    });
  } catch (error) {
    console.error("[coupon-redeem] redeem failed", error);
    return NextResponse.json(
      { ok: false, message: "쿠폰 사용 확인에 실패했습니다." },
      { status: 503 },
    );
  }
}
