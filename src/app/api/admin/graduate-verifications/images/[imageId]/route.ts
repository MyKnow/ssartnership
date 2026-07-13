import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ imageId: string }> }) {
  const denied = await ensureAdminApiPermission(request, "graduate_verifications", "read");
  if (denied) return denied;
  const { imageId } = await context.params;
  if (!UUID_PATTERN.test(imageId)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  const { data } = await getSupabaseAdminClient()
    .from("member_profile_images")
    .select("storage_path")
    .eq("id", imageId)
    .maybeSingle();
  const path = (data as { storage_path?: string | null } | null)?.storage_path;
  if (!path) return NextResponse.json({ message: "본인 사진을 찾을 수 없습니다." }, { status: 404 });
  const body = await downloadPrivateMemberProfileImage(path);
  if (!body) return NextResponse.json({ message: "본인 사진을 불러오지 못했습니다." }, { status: 404 });
  const session = await getAdminSession();
  void logAdminAudit({
    ...getRequestLogContext(request),
    action: "graduate_profile_photo_view",
    actorId: session?.adminId ?? null,
    targetType: "member_profile_image",
    targetId: imageId,
    properties: {},
  });
  return new NextResponse(body, {
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
