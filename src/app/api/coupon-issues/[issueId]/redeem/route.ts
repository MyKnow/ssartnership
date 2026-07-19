import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { consumeProductEventQuota } from "@/lib/product-event-throttle";
import { adPackageRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

type RedeemRequestBody = {
  sessionId?: unknown;
  onsitePassword?: unknown;
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
    case "inactive":
    case "expired":
    case "onsite_password_required":
    case "onsite_password_invalid":
      return 409;
    default:
      return 400;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
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

  const issueId = safeDecodeSegment((await params).issueId ?? "");
  if (!issueId || issueId.length > 128) {
    return NextResponse.json({ ok: false, message: "쿠폰 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  let body: RedeemRequestBody = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as RedeemRequestBody;
    }
  } catch {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const onsitePassword = body.onsitePassword;
  if (
    onsitePassword !== undefined &&
    onsitePassword !== null &&
    typeof onsitePassword !== "string"
  ) {
    return NextResponse.json(
      { ok: false, message: "현장 확인 비밀번호 형식을 확인해 주세요." },
      { status: 400 },
    );
  }
  if (typeof onsitePassword === "string" && onsitePassword && !/^\d+$/.test(onsitePassword)) {
    return NextResponse.json(
      { ok: false, message: "현장 확인 비밀번호는 숫자만 입력해 주세요." },
      { status: 400 },
    );
  }

  const context = getRequestLogContext(request);
  const sessionId = normalizeSessionId(body.sessionId);
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
    const result = await adPackageRepository.redeemCouponIssue({
      issueId,
      memberId: session.userId,
      sessionId,
      onsitePassword: typeof onsitePassword === "string" ? onsitePassword || null : null,
      metadata: {
        path: context.path,
        userAgent: context.userAgent,
      },
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: statusForReason(result.reason) });
    }

    scheduleProductEventLog({
      ...context,
      actorType: "member",
      actorId: session.userId,
      sessionId,
      eventName: "coupon_redeem",
      targetType: "ad_coupon",
      targetId: result.couponId,
      properties: {
        issueId: result.issueId,
        assignedCode: Boolean(result.assignedCode),
      },
    });

    return NextResponse.json({
      ok: true,
      couponId: result.couponId,
      issueId: result.issueId,
    });
  } catch (error) {
    console.error("[coupon-issue-redeem] failed", error);
    return NextResponse.json(
      { ok: false, message: "쿠폰 사용 확인에 실패했습니다." },
      { status: 503 },
    );
  }
}
