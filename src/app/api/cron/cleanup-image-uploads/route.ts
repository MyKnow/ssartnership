import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}
/** Removes expired private staging objects in bounded batches. */
export async function GET(request: NextRequest) {
  if (!await isAdminSession() && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const expired = await getImageUploadRepository().expireStale();
    return NextResponse.json({
      ok: true,
      expired,
      processedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "만료된 이미지 임시 파일을 정리하지 못했습니다." },
      { status: 500 },
    );
  }
}
