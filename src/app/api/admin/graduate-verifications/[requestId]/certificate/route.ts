import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { GRADUATE_CERTIFICATES_BUCKET } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  const denied = await ensureAdminApiPermission(request, "graduate_verifications", "read");
  if (denied) return denied;
  const { requestId } = await context.params;
  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("graduate_verification_requests")
    .select("certificate_storage_path")
    .eq("id", requestId)
    .maybeSingle();
  const path = (data as { certificate_storage_path?: string | null } | null)?.certificate_storage_path;
  if (!path) return NextResponse.json({ message: "수료증을 찾을 수 없습니다." }, { status: 404 });
  const { data: file, error } = await supabase.storage.from(GRADUATE_CERTIFICATES_BUCKET).download(path);
  if (error || !file) return NextResponse.json({ message: "수료증을 불러오지 못했습니다." }, { status: 404 });
  const session = await getAdminSession();
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
      "content-disposition": "inline; filename=graduate-certificate.pdf",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
