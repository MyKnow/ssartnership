import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  if (!isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const denied = await ensureAdminApiPermission(request, "profile_images", "update");
  if (denied) return denied;
  return NextResponse.json(
    { ok: false, message: "사진 업로드 방식이 변경되었습니다. 페이지를 새로고침한 뒤 다시 선택해 주세요." },
    { status: 410 },
  );
}
