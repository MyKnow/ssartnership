import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";
import {
  createMemberProfileImageResponse,
  getMemberProfileImageRevalidation,
} from "@/lib/member-profile-image-response";
import { withServerTiming } from "@/lib/server-timing";
import { isUuidFormat } from "@/lib/uuid";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  return withServerTiming(async (timing) => {
    const denied = await timing.measure("auth", () => ensureAdminApiPermission(request, "profile_images", "read"));
    if (denied) return denied;

    const { memberId } = await context.params;
    if (!isUuidFormat(memberId)) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
    }

    const image = await timing.measure("query", () => getActiveMemberProfileImage(memberId));
    if (!image) {
      return NextResponse.json({ message: "현재 사진을 찾을 수 없습니다." }, { status: 404 });
    }

    const session = await timing.measure("session", () => getAdminSession());
    void logAdminAudit({
      ...getRequestLogContext(request),
      action: "member_profile_photo_view",
      actorId: session?.adminId ?? null,
      targetType: "member",
      targetId: memberId,
      properties: { source: "private_profile_image" },
    });

    // 감사 로그는 재검증(304) 요청에도 남긴다: 브라우저가 매 사용 전 서버에 확인하므로 열람 시점이 기록된다.
    const revalidation = getMemberProfileImageRevalidation(request, image);
    if (revalidation.notModified) {
      return revalidation.notModified;
    }

    const body = await timing.measure("storage", () => downloadPrivateMemberProfileImage(image.storagePath));
    if (!body) {
      return NextResponse.json(
        { message: "현재 사진을 불러오지 못했습니다." },
        { status: 404 },
      );
    }

    return createMemberProfileImageResponse(body, revalidation.headers);
  });
}
