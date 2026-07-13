import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";

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

  const image = await getActiveMemberProfileImage(memberId);
  if (!image) {
    return NextResponse.json({ message: "현재 사진을 찾을 수 없습니다." }, { status: 404 });
  }

  const session = await getAdminSession();
  void logAdminAudit({
    ...getRequestLogContext(request),
    action: "member_profile_photo_view",
    actorId: session?.adminId ?? null,
    targetType: "member",
    targetId: memberId,
    properties: { source: "private_profile_image" },
  });

  const body = await downloadPrivateMemberProfileImage(image.storagePath);
  if (!body) {
    return NextResponse.json(
      { message: "현재 사진을 불러오지 못했습니다." },
      { status: 404 },
    );
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
