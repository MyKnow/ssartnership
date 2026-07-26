import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { getAdminReviewById } from "@/lib/admin-reviews";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const accessDenied = await ensureAdminApiPermission(request, "reviews", "read");
  if (accessDenied) {
    return accessDenied;
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { message: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    const { reviewId } = await params;
    const review = await getAdminReviewById(
      reviewId,
      getManagedCampusFilterValues(session.account),
    );
    if (!review) {
      return NextResponse.json(
        { message: "리뷰를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json(review, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { message: "리뷰 상세를 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
