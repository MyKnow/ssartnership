import { NextResponse } from "next/server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  return NextResponse.json(
    { ok: false, message: "사진 업로드 방식이 변경되었습니다. 페이지를 새로고침한 뒤 다시 선택해 주세요." },
    { status: 410 },
  );
}
