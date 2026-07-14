import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { submitMemberProfileImageReplacement } from "@/lib/graduate-verification-service";
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

  const { id: memberId } = await context.params;
  const body = await request.json().catch(() => null) as { uploadId?: unknown } | null;
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
  if (!UUID_PATTERN.test(memberId) || !UUID_PATTERN.test(uploadId)) {
    return NextResponse.json({ ok: false, message: "사진 업로드를 확인해 주세요." }, { status: 400 });
  }

  try {
    const result = await submitMemberProfileImageReplacement({ memberId, uploadId });
    const session = await getAdminSession();
    void logAdminAudit({
      ...getRequestLogContext(request),
      action: "member_profile_photo_replace",
      actorId: session?.adminId ?? null,
      targetType: "member_profile_image",
      targetId: result.imageId,
      properties: { memberId },
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "사진 변경 요청을 저장하지 못했습니다." },
      { status: 400 },
    );
  }
}
