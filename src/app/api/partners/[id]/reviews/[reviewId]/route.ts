import { NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { partnerReviewRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  deleteReviewMediaUrls,
} from "@/lib/review-media-storage";
import {
  ensureVisibleReviewPartner,
  getReviewMemberSession,
  parseReviewFormFields,
  resolveReviewMediaPayload,
} from "../_shared";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; reviewId: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["multipart/form-data"],
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
      { ok: false, message: "로그인 후 리뷰를 수정할 수 있습니다." },
      { status: 401 },
    );
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const ownedReview = await partnerReviewRepository.getOwnedPartnerReview(
    reviewId,
    session.userId,
  );
  if (!ownedReview || ownedReview.partnerId !== id) {
    return NextResponse.json({ ok: false, message: "리뷰를 찾을 수 없습니다." }, { status: 404 });
  }
  if (ownedReview.deletedAt) {
    return NextResponse.json({ ok: false, message: "이미 삭제된 리뷰입니다." }, { status: 409 });
  }
  if (ownedReview.hiddenAt) {
    return NextResponse.json(
      { ok: false, message: "비공개 처리된 리뷰는 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  const formData = await request.formData();
  const parsed = parseReviewFormFields(formData);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, fieldErrors: parsed.fieldErrors },
      { status: 400 },
    );
  }

  let uploadedUrls: string[] = [];

  try {
    const media = await resolveReviewMediaPayload(
      formData,
      id,
      reviewId,
      session.userId,
      ownedReview.images,
    );
    uploadedUrls = media.uploadedUrls;
    const review = await partnerReviewRepository.updatePartnerReview({
      reviewId,
      memberId: session.userId,
      rating: parsed.rating,
      title: parsed.title,
      body: parsed.body,
      images: media.images,
    });
    const removedUrls = ownedReview.images.filter((url) => !media.images.includes(url));
    await deleteReviewMediaUrls(removedUrls).catch(() => undefined);
    const summary = await partnerReviewRepository.getPartnerReviewSummary(id);
    scheduleProductEventLog({
      ...getRequestLogContext(request),
      actorType: "member",
      actorId: session.userId,
      eventName: "partner_review_update",
      targetType: "partner_review",
      targetId: review.id,
      properties: {
        partnerId: id,
        rating: parsed.rating,
        imageCount: media.images.length,
      },
    });
    return NextResponse.json({ ok: true, review, summary });
  } catch (error) {
    await deleteReviewMediaUrls(uploadedUrls).catch(() => undefined);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "리뷰 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; reviewId: string }> },
) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "잘못된 요청입니다." },
      { status: 403 },
    );
  }

  const { id, reviewId } = await context.params;
  const session = await getReviewMemberSession().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "로그인 후 리뷰를 삭제할 수 있습니다." },
      { status: 401 },
    );
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const ownedReview = await partnerReviewRepository.getOwnedPartnerReview(
    reviewId,
    session.userId,
  );
  if (!ownedReview || ownedReview.partnerId !== id) {
    return NextResponse.json({ ok: false, message: "리뷰를 찾을 수 없습니다." }, { status: 404 });
  }
  if (ownedReview.deletedAt) {
    return NextResponse.json({ ok: false, message: "이미 삭제된 리뷰입니다." }, { status: 409 });
  }
  if (ownedReview.hiddenAt) {
    return NextResponse.json(
      { ok: false, message: "비공개 처리된 리뷰는 삭제할 수 없습니다." },
      { status: 409 },
    );
  }

  try {
    await partnerReviewRepository.softDeletePartnerReview({
      reviewId,
      memberId: session.userId,
    });
    const summary = await partnerReviewRepository.getPartnerReviewSummary(id);
    scheduleProductEventLog({
      ...getRequestLogContext(request),
      actorType: "member",
      actorId: session.userId,
      eventName: "partner_review_delete",
      targetType: "partner_review",
      targetId: reviewId,
      properties: {
        partnerId: id,
      },
    });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "리뷰 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
