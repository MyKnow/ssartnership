import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { createManualMemberImportTemplate } from "@/lib/member-manual-import/xlsx.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await ensureAdminApiPermission(request, "members", "create");
  if (denied) return denied;
  const workbook = await createManualMemberImportTemplate();
  return new NextResponse(workbook, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="ssartnership-member-import-template.xlsx"',
      "cache-control": "private, no-store",
    },
  });
}
