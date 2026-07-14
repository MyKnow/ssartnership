import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { canAdmin } from "@/lib/admin-permissions";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { commitManualMemberImport } from "@/lib/member-manual-import/service.server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> },
) {
  if (!isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  })) {
    return NextResponse.json({ message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  if (!canAdmin(session.account.permissions, "members", "create")) {
    return NextResponse.json({ message: "회원 생성 권한이 필요합니다." }, { status: 403 });
  }
  const { batchId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(batchId)) {
    return NextResponse.json({ message: "가져오기 배치를 확인해 주세요." }, { status: 400 });
  }
  try {
    const result = await commitManualMemberImport({ adminId: session.adminId, batchId });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ message: "가져오기 생성에 실패했습니다." }, { status: 400 });
  }
}
