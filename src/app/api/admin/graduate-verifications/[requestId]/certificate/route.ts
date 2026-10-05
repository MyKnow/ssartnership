import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { GRADUATE_CERTIFICATES_BUCKET } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withServerTiming } from "@/lib/server-timing";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  return withServerTiming(async (timing) => {
    const denied = await timing.measure("auth", () => ensureAdminApiPermission(request, "graduate_verifications", "read"));
    if (denied) return denied;
    const { requestId } = await context.params;
    if (!UUID_PATTERN.test(requestId)) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
    }
    const supabase = getSupabaseAdminClient();
    const { data } = await timing.measure("query", () => supabase
      .from("graduate_verification_requests")
      .select("certificate_storage_path")
      .eq("id", requestId)
      .maybeSingle());
    const path = (data as { certificate_storage_path?: string | null } | null)?.certificate_storage_path;
    if (!path) return NextResponse.json({ message: "수료증을 찾을 수 없습니다." }, { status: 404 });
    const { data: file, error } = await timing.measure("storage", () => supabase.storage.from(GRADUATE_CERTIFICATES_BUCKET).download(path));
    if (error || !file) return NextResponse.json({ message: "수료증을 불러오지 못했습니다." }, { status: 404 });
    const session = await timing.measure("session", () => getAdminSession());
    void logAdminAudit({
      ...getRequestLogContext(request),
      action: "graduate_certificate_view",
      actorId: session?.adminId ?? null,
      targetType: "graduate_verification_request",
      targetId: requestId,
      properties: {},
    });
    const body = await file.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(body.byteLength),
        // 관리자 화면은 fetch 후 pdf.js로 이미지 렌더링하므로, 직접 열람 시에는
        // 브라우저 PDF 뷰어에서 실행하지 않고 내려받도록 한다.
        "content-disposition": 'attachment; filename="graduate-certificate.pdf"',
        "content-security-policy": "sandbox; default-src 'none'",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
