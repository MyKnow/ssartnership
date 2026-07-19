import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-access";
import { parseCouponCodeWorkbook } from "@/lib/ad-coupon-code-import.server";
import { adPackageRepository } from "@/lib/repositories";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> },
) {
  await requireAdminPermission("home_ads", "update", { path: "/admin/advertisement" });
  const couponId = decodeURIComponent((await params).couponId ?? "").trim();
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "엑셀 파일을 선택해 주세요." }, { status: 400 });
  try {
    const codes = await parseCouponCodeWorkbook(file);
    const result = await adPackageRepository.addCouponCodes({ couponId, codes });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "코드 업로드에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
