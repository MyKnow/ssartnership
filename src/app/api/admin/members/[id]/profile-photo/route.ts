import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import {
  replaceMemberProfileImageByAdmin,
} from "@/lib/graduate-verification-service";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const denied = await ensureAdminApiPermission(request, "profile_images", "update");
  if (denied) return denied;
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const rateLimitContext = {
    route: "admin-member-profile-photo-submit" as const,
    accountIdentifier: session.adminId,
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "사진 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { id: memberId } = await context.params;
  const body = await request.json().catch(() => null) as { uploadId?: unknown } | null;
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
  if (!UUID_PATTERN.test(memberId) || !UUID_PATTERN.test(uploadId)) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({ ok: false, message: "사진 업로드를 확인해 주세요." }, { status: 400 });
  }

  try {
    const result = await replaceMemberProfileImageByAdmin({
      memberId,
      uploadId,
      adminId: session.adminId,
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    void logAdminAudit({
      ...getRequestLogContext(request),
      action: "member_profile_photo_replace",
      actorId: session.adminId,
      targetType: "member_profile_image",
      targetId: result.imageId,
      properties: { memberId, source: "manual_admin" },
    });
    return NextResponse.json({ ok: true, result });
  } catch {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json(
      { ok: false, message: "사진을 변경하지 못했습니다. 다시 선택해 주세요." },
      { status: 400 },
    );
  }
}
