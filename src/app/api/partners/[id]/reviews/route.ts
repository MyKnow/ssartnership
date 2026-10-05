import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { getSafePublicRouteError } from "@/lib/public-route-safe-errors";
import { partnerReviewRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  deleteReviewMediaUrls,
} from "@/lib/review-media-storage";
import {
  ensurePartnerReviewModerationAccess,
  ensureVisibleReviewPartner,
  getReviewMediaInputFieldErrors,
  getReviewMemberSessionLookup,
  isReviewImageUploadUnavailable,
  parseReviewListParams,
  readPartnerReviewSubmission,
  resolveReviewMediaPayload,
  reviewSessionUnavailableResponse,
} from "./_shared";
import { memberApiSessionDeniedResponse } from "@/lib/member-api-session";
import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "잘못된 요청입니다." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  // A public listing degrades to anonymous when the member session cannot
  // be read (the lookup already logged it); moderation needs a real answer.
  const sessionLookup = await getReviewMemberSessionLookup();
  const session = sessionLookup.ok ? sessionLookup.session : null;
  const { sort, offset, limit, rating, imagesOnly, includeHidden } = parseReviewListParams(request);
  if (includeHidden) {
    const moderationAccess = await ensurePartnerReviewModerationAccess(id);
    if (moderationAccess === "unavailable") {
      return reviewSessionUnavailableResponse();
    }
    if (moderationAccess !== "allowed") {
      return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
    }
  }
  if (!includeHidden) {
    const partner = await ensureVisibleReviewPartner(id, session?.userId ?? null);
    if (!partner) {
      return NextResponse.json({ message: "대상을 찾을 수 없습니다." }, { status: 404 });
    }
  }
  const result = await partnerReviewRepository.listPartnerReviews({
    partnerId: id,
    currentUserId: session?.userId ?? null,
    sort,
    offset,
    limit,
    rating,
    imagesOnly,
    includeHidden,
  });

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
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

  const { id } = await context.params;
  const sessionLookup = await getReviewMemberSessionLookup();
  if (!sessionLookup.ok) {
    return reviewSessionUnavailableResponse();
  }
  const session = sessionLookup.session;
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "로그인 후 리뷰를 작성할 수 있습니다." },
      { status: 401 },
    );
  }
  if (session.mustChangePassword) {
    return memberApiSessionDeniedResponse("password_change_required");
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const submission = await readPartnerReviewSubmission(request);
  if (!submission.ok) {
    return NextResponse.json(
      {
        ok: false,
        ...(submission.message ? { message: submission.message } : {}),
        ...(submission.fieldErrors
          ? { fieldErrors: submission.fieldErrors }
          : {}),
      },
      { status: submission.status },
    );
  }
  const payload = submission.values;

  const reviewId = payload.reviewId ?? randomUUID();
  const existingReview = await partnerReviewRepository.getPartnerReviewById(
    reviewId,
    session.userId,
  );
  if (existingReview) {
    if (existingReview.partnerId !== id || existingReview.memberId !== session.userId) {
      return NextResponse.json({ ok: false, message: "리뷰 요청을 확인해 주세요." }, { status: 409 });
    }
    const summary = await partnerReviewRepository.getPartnerReviewSummary(id);
    return NextResponse.json({ ok: true, review: existingReview, summary, idempotent: true });
  }
  // Filled as each image attaches. Cleanup waits until the catch below has
  // checked for a review stored by a duplicate request: both requests attach
  // to the same deterministic paths, so a partial failure here must not delete
  // files the winning request's review already references.
  const uploadedUrls: string[] = [];
  // Once the insert is sent, a failure no longer proves the review was not
  // stored: after the Supabase deadline (TimeoutError) the statement may still
  // commit in the database.
  let reviewInsertSent = false;

  try {
    const media = await resolveReviewMediaPayload(
      payload.imagesManifest,
      id,
      reviewId,
      session.userId,
      [],
      { attachedUrls: uploadedUrls },
    );
    reviewInsertSent = true;
    const review = await partnerReviewRepository.createPartnerReview({
      reviewId,
      partnerId: id,
      memberId: session.userId,
      rating: payload.rating,
      title: payload.title,
      body: payload.body,
      images: media.images,
    });
    const summary = await partnerReviewRepository.getPartnerReviewSummary(id);
    scheduleProductEventLog({
      ...getRequestLogContext(request),
      actorType: "member",
      actorId: session.userId,
      eventName: "partner_review_create",
      targetType: "partner_review",
      targetId: review.id,
      properties: {
        partnerId: id,
        rating: payload.rating,
        imageCount: media.images.length,
      },
    });
    return NextResponse.json({ ok: true, review, summary });
  } catch (error) {
    // The client-generated reviewId is the idempotency key. A duplicate
    // submission that lost a race (primary key conflict, or an image the
    // winning request already attached) answers with the stored review before
    // any error is mapped, so a double tap never reports a failed save.
    const storedLookup = await partnerReviewRepository
      .getPartnerReviewById(reviewId, session.userId)
      .then(
        (review) => ({ answered: true, review }) as const,
        () => ({ answered: false, review: null }) as const,
      );
    const storedReview = storedLookup.review;
    if (
      storedReview
      && storedReview.partnerId === id
      && storedReview.memberId === session.userId
    ) {
      // Attachments resolve to deterministic per-review paths, so only files
      // the stored review does not reference are this request's leftovers.
      const leftoverUrls = uploadedUrls.filter(
        (url) => !storedReview.images.includes(url),
      );
      if (leftoverUrls.length > 0) {
        await deleteReviewMediaUrls(leftoverUrls).catch(() => undefined);
      }
      const summary = await partnerReviewRepository.getPartnerReviewSummary(id);
      return NextResponse.json({ ok: true, review: storedReview, summary, idempotent: true });
    }
    // Everything this request attached, including images attached before a
    // media error, is a leftover only once no review can still reference it:
    // the lookup answered, and either the insert was never sent or another
    // review holds this id. A failed lookup, or a sent insert with no visible
    // review, keeps the files; an orphan costs less than a stored review
    // pointing at deleted images.
    const leftoversConfirmed =
      storedLookup.answered && (!reviewInsertSent || storedReview !== null);
    if (leftoversConfirmed && uploadedUrls.length > 0) {
      await deleteReviewMediaUrls(uploadedUrls).catch(() => undefined);
    }
    if (isReviewImageUploadUnavailable(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: "image_upload_unavailable",
          message: "현재 환경에서는 이미지 업로드를 사용할 수 없습니다.",
        },
        { status: 503 },
      );
    }
    const mediaFieldErrors = getReviewMediaInputFieldErrors(error);
    if (mediaFieldErrors) {
      return NextResponse.json(
        { ok: false, fieldErrors: mediaFieldErrors },
        { status: 400 },
      );
    }
    logServerError("[partner-reviews] create failed", error);
    const safeError = getSafePublicRouteError(
      error,
      "리뷰 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { ok: false, message: safeError.message },
      { status: safeError.status },
    );
  }
}
