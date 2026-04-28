import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getPartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { getPartnerSession } from "@/lib/partner-session";
import { partnerReviewRepository } from "@/lib/repositories";

export const runtime = "nodejs";

function parseModerationAction(value: unknown) {
  return value === "hide" || value === "restore" ? value : null;
}

function revalidatePartnerReviewPaths(partnerId: string) {
  revalidatePath(`/partner/services/${partnerId}`);
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/admin/reviews");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  const session = await getPartnerSession().catch(() => null);
  if (!session || session.mustChangePassword) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { reviewId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = parseModerationAction((body as { action?: unknown }).action);
  if (!reviewId || !action) {
    return NextResponse.json({ ok: false, message: "요청값을 확인해 주세요." }, { status: 400 });
  }

  const record = await partnerReviewRepository.getPartnerReviewModerationRecord(reviewId);
  if (!record || record.deletedAt) {
    return NextResponse.json({ ok: false, message: "리뷰를 찾을 수 없습니다." }, { status: 404 });
  }

  const reviewContext = await getPartnerChangeRequestContext(
    session.companyIds,
    record.partnerId,
  );
  if (!reviewContext) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const result =
    action === "hide"
      ? await partnerReviewRepository.hidePartnerReview(reviewId, {
          actorType: "partner",
          partnerAccountId: session.accountId,
        })
      : await partnerReviewRepository.restorePartnerReview(reviewId, {
          actorType: "partner",
          partnerAccountId: session.accountId,
        });

  if (!result) {
    return NextResponse.json(
      { ok: false, message: "이미 처리된 리뷰입니다." },
      { status: 409 },
    );
  }

  revalidatePartnerReviewPaths(result.partnerId);
  await logAdminAudit({
    ...getRequestLogContext(request),
    actorId: session.accountId,
    action: action === "hide" ? "partner_review_hide" : "partner_review_restore",
    targetType: "partner_review",
    targetId: reviewId,
    properties: {
      partnerId: result.partnerId,
      companyIds: session.companyIds,
      actorLoginId: session.loginId,
      actorDisplayName: session.displayName,
    },
  });
  return NextResponse.json({ ok: true });
}
