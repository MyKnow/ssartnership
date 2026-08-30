import { NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { getSafePublicRouteError } from "@/lib/public-route-safe-errors";
import { partnerReviewRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { ensureVisibleReviewPartner, getReviewMemberSession } from "../../_shared";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; reviewId: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json(
      { ok: false, message: "잘못된 요청입니다." },
      { status: 403 },
    );
  }

  const { id, reviewId } = await context.params;
  const session = await getReviewMemberSession().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "로그인 후 리뷰에 반응할 수 있습니다." },
      { status: 401 },
    );
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const moderationRecord = await partnerReviewRepository.getPartnerReviewModerationRecord(reviewId);
  if (!moderationRecord || moderationRecord.partnerId !== id) {
    return NextResponse.json({ ok: false, message: "리뷰를 찾을 수 없습니다." }, { status: 404 });
  }
  if (moderationRecord.deletedAt) {
    return NextResponse.json({ ok: false, message: "삭제된 리뷰에는 반응할 수 없습니다." }, { status: 409 });
  }
  if (moderationRecord.hiddenAt) {
    return NextResponse.json({ ok: false, message: "비공개 처리된 리뷰에는 반응할 수 없습니다." }, { status: 409 });
  }

  let body: { reaction?: unknown } | null = null;
  try {
    body = await readRouteJsonBodyWithinLimit<{ reaction?: unknown } | null>(
      request,
      {
        maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
        invalidMessage: "반응 종류를 확인해 주세요.",
        tooLargeMessage: "요청이 너무 큽니다.",
      },
    );
  } catch (error) {
    if (error instanceof RouteJsonBodyError && error.code === "body_too_large") {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
  }
  const reaction =
    body?.reaction === "recommend" || body?.reaction === "disrecommend"
      ? body.reaction
      : body?.reaction === null
        ? null
        : undefined;

  if (reaction === undefined) {
    return NextResponse.json(
      { ok: false, message: "반응 종류를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const review = await partnerReviewRepository.setPartnerReviewReaction({
      reviewId,
      memberId: session.userId,
      reaction,
    });
    if (reaction) {
      scheduleProductEventLog({
        ...getRequestLogContext(request),
        actorType: "member",
        actorId: session.userId,
        eventName:
          reaction === "recommend"
            ? "partner_review_recommend"
            : "partner_review_disrecommend",
        targetType: "partner_review",
        targetId: reviewId,
        properties: {
          partnerId: id,
          reaction,
          resultingMyReaction: review.myReaction,
        },
      });
    }
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    console.error("[partner-review-reaction] update failed", error);
    const safeError = getSafePublicRouteError(
      error,
      "리뷰 반응에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { ok: false, message: safeError.message },
      { status: safeError.status },
    );
  }
}
