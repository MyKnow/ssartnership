import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-access";
import { parseCouponCodeWorkbook } from "@/lib/ad-coupon-code-import.server";
import { adPackageRepository } from "@/lib/repositories";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> },
) {
  return withServerTiming(async (timing) => {
    await timing.measure("auth", () => requireAdminPermission("home_ads", "update", { path: "/admin/advertisement" }));
    const couponId = decodeURIComponent((await params).couponId ?? "").trim();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "엑셀 파일을 선택해 주세요." }, { status: 400 });
    try {
      const codes = await timing.measure("query", () => parseCouponCodeWorkbook(file));
      const result = await timing.measure("mutation", () => adPackageRepository.addCouponCodes({ couponId, codes }));
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      console.error("[admin-ad-coupon-codes] upload failed", error);
      return NextResponse.json(
        { ok: false, message: "코드 업로드에 실패했습니다. 파일과 쿠폰 상태를 확인한 뒤 다시 시도해 주세요." },
        { status: 400 },
      );
    }
  });
}
