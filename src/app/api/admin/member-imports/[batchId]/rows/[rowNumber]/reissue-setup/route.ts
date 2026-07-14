import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminSession } from "@/lib/auth";
import { MANUAL_MEMBER_IMPORT_LIMITS } from "@/lib/member-manual-import/shared";
import { reissueManualMemberImportSetup } from "@/lib/member-manual-import/service.server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

const BATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/iu;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string; rowNumber: string }> },
) {
  if (!isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  })) {
    return NextResponse.json({ message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!canAdmin(session.account.permissions, "members", "update")) {
    return NextResponse.json({ message: "회원 수정 권한이 필요합니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { confirmed?: unknown } | null;
  if (body?.confirmed !== true) {
    return NextResponse.json({ message: "새 초기 설정 링크 발급 확인이 필요합니다." }, { status: 400 });
  }
  const { batchId, rowNumber: rowNumberParam } = await context.params;
  const rowNumber = Number(rowNumberParam);
  if (
    !BATCH_ID_PATTERN.test(batchId)
    || !Number.isSafeInteger(rowNumber)
    || rowNumber < 1
    || rowNumber > MANUAL_MEMBER_IMPORT_LIMITS.maxRows + 1
  ) {
    return NextResponse.json({ message: "가져오기 행을 확인해 주세요." }, { status: 400 });
  }

  const audit = {
    ...getRequestLogContext(request),
    action: "member_manual_setup_link_reissue" as const,
    actorId: session.adminId,
    targetType: "manual_member_import_row",
    targetId: `${batchId}:${rowNumber}`,
    properties: { batchId, rowNumber, confirmed: true },
  };
  try {
    const item = await reissueManualMemberImportSetup({ batchId, rowNumber });
    await logAdminAudit({ ...audit, properties: { ...audit.properties, outcome: "success" } });
    return NextResponse.json({ ok: true, item });
  } catch {
    await logAdminAudit({ ...audit, properties: { ...audit.properties, outcome: "failure" } });
    return NextResponse.json(
      { message: "새 초기 설정 링크를 발급하지 못했습니다. 수신 여부를 확인한 뒤 다시 시도해 주세요." },
      { status: 400 },
    );
  }
}
