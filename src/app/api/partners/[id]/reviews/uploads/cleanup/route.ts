import { NextResponse } from "next/server";
import { extractReviewMediaStoragePath, REVIEW_MEDIA_BUCKET } from "@/lib/review-media";
import { deleteReviewMediaUrls } from "@/lib/review-media-storage";
import {
  ensureVisibleReviewPartner,
  getReviewMemberSession,
  parseRequestedReviewId,
} from "../../_shared";

export const runtime = "nodejs";

function parseReviewId(value: unknown) {
  const formData = new FormData();
  if (typeof value === "string") {
    formData.set("reviewId", value);
  }
  return parseRequestedReviewId(formData);
}

function parseUrls(value: unknown, partnerId: string, reviewId: string) {
  if (!Array.isArray(value)) {
    return [];
  }
  const expectedPrefix = `reviews/${partnerId.trim()}/${reviewId.trim()}/`;
  return value.filter((item): item is string => {
    if (typeof item !== "string" || item.length === 0) {
      return false;
    }
    const storagePath = extractReviewMediaStoragePath(item);
    return (
      storagePath?.bucket === REVIEW_MEDIA_BUCKET &&
      storagePath.path.startsWith(expectedPrefix)
    );
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getReviewMemberSession().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 401 });
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const reviewId = parseReviewId((body as { reviewId?: unknown } | null)?.reviewId);
  if (!reviewId) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 400 });
  }

  const urls = parseUrls((body as { urls?: unknown } | null)?.urls, id, reviewId);
  if (urls.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await deleteReviewMediaUrls(urls).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
