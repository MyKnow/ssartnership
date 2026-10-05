import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { MANUAL_MEMBER_IMPORT_LIMITS } from "@/lib/member-manual-import/shared";
import { parseManualMemberImportWorkbook } from "@/lib/member-manual-import/xlsx.server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withServerTiming(async (timing) => {
    if (!isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["multipart/form-data"],
    })) {
      return NextResponse.json({ message: "요청을 확인해 주세요." }, { status: 403 });
    }
    const denied = await timing.measure("auth", () => ensureAdminApiPermission(request, "members", "create"));
    if (denied) return denied;

    try {
      const formData = await request.formData();
      const file = formData.get("xlsx");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, errors: ["XLSX 파일을 선택해 주세요."] }, { status: 400 });
      }
      if (file.size <= 0 || file.size > MANUAL_MEMBER_IMPORT_LIMITS.xlsxBytes) {
        return NextResponse.json({ ok: false, errors: ["XLSX 파일은 1MB 이하만 업로드할 수 있습니다."] }, { status: 400 });
      }
      const rows = await timing.measure("query", async () => parseManualMemberImportWorkbook(Buffer.from(await file.arrayBuffer())));
      return NextResponse.json({ ok: true, rows });
    } catch {
      return NextResponse.json({ ok: false, errors: ["XLSX 행을 읽지 못했습니다."] }, { status: 400 });
    }
  });
}
