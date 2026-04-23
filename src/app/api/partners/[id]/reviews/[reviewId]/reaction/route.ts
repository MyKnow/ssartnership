import { NextResponse } from "next/server";
import { partnerReviewRepository } from "@/lib/repositories";
import { ensureVisibleReviewPartner, getReviewMemberSession } from "../../_shared";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; reviewId: string }> },
) {
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

  const body = await request.json().catch(() => null);
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
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "리뷰 반응에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    const status = message.includes("찾을 수 없습니다.") ? 404 : 503;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
