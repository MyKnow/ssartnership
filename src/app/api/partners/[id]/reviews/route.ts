import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { partnerReviewRepository } from "@/lib/repositories";
import { deleteReviewMediaUrls } from "@/lib/review-media-storage";
import {
  ensureVisibleReviewPartner,
  getReviewMemberSession,
  parseReviewFormFields,
  parseReviewListParams,
  resolveReviewMediaPayload,
} from "./_shared";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getReviewMemberSession().catch(() => null);
  const partner = await ensureVisibleReviewPartner(id, session?.userId ?? null);
  if (!partner) {
    return NextResponse.json({ message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const { sort, offset, limit } = parseReviewListParams(request);
  const result = await partnerReviewRepository.listPartnerReviews({
    partnerId: id,
    currentUserId: session?.userId ?? null,
    sort,
    offset,
    limit,
  });

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getReviewMemberSession().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "로그인 후 리뷰를 작성할 수 있습니다." },
      { status: 401 },
    );
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const formData = await request.formData();
  const parsed = parseReviewFormFields(formData);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, fieldErrors: parsed.fieldErrors },
      { status: 400 },
    );
  }

  const reviewId = randomUUID();
  let uploadedUrls: string[] = [];

  try {
    const media = await resolveReviewMediaPayload(formData, id, reviewId);
    uploadedUrls = media.uploadedUrls;
    const review = await partnerReviewRepository.createPartnerReview({
      reviewId,
      partnerId: id,
      memberId: session.userId,
      rating: parsed.rating,
      title: parsed.title,
      body: parsed.body,
      images: media.images,
    });
    const summary = await partnerReviewRepository.getPartnerReviewSummary(id);
    return NextResponse.json({ ok: true, review, summary });
  } catch (error) {
    await deleteReviewMediaUrls(uploadedUrls).catch(() => undefined);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "리뷰 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
