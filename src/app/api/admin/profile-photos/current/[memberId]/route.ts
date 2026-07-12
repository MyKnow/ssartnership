import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { createMemberAvatarResponse } from "@/lib/member-avatar-response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  const denied = await ensureAdminApiPermission(request, "profile_images", "read");
  if (denied) return denied;

  const { memberId } = await context.params;
  if (!UUID_PATTERN.test(memberId)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("active_profile_image_id,avatar_content_type,avatar_base64,avatar_url,updated_at,profile_photo_review_status")
    .eq("id", memberId)
    .maybeSingle();

  if (error || !data || data.profile_photo_review_status !== "approved") {
    return NextResponse.json({ message: "현재 사진을 찾을 수 없습니다." }, { status: 404 });
  }

  const session = await getAdminSession();
  void logAdminAudit({
    ...getRequestLogContext(request),
    action: "member_profile_photo_view",
    actorId: session?.adminId ?? null,
    targetType: "member",
    targetId: memberId,
    properties: { source: data.active_profile_image_id ? "private_profile_image" : "legacy_avatar" },
  });

  if (data.active_profile_image_id) {
    const { data: image } = await supabase
      .from("member_profile_images")
      .select("storage_path")
      .eq("id", data.active_profile_image_id)
      .eq("status", "approved")
      .maybeSingle();
    const path = (image as { storage_path?: string | null } | null)?.storage_path;
    if (!path) {
      return NextResponse.json({ message: "현재 사진을 찾을 수 없습니다." }, { status: 404 });
    }
    const body = await downloadPrivateMemberProfileImage(path);
    if (!body) {
      return NextResponse.json({ message: "현재 사진을 불러오지 못했습니다." }, { status: 404 });
    }
    return new NextResponse(body, {
      headers: {
        "content-type": "image/webp",
        "content-length": String(body.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return createMemberAvatarResponse(
    {
      avatarUrl: data.avatar_url,
      avatarBase64: data.avatar_base64,
      avatarContentType: data.avatar_content_type,
    },
    { cacheControl: "private, no-store", lastModified: data.updated_at },
  );
}
