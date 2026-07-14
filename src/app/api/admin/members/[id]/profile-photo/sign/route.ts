import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { createGraduateVerificationSignedUpload } from "@/lib/graduate-verification-storage";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProfileImageContentType(value: unknown): value is "image/webp" {
  return value === "image/webp";
}

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
    route: "admin-member-profile-photo-sign" as const,
    accountIdentifier: session.adminId,
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "사진 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { id: memberId } = await context.params;
  const body = await request.json().catch(() => null) as {
    contentType?: unknown;
    size?: unknown;
  } | null;
  if (!UUID_PATTERN.test(memberId) || !isProfileImageContentType(body?.contentType) || typeof body?.size !== "number") {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({ ok: false, message: "사진 업로드 요청을 확인해 주세요." }, { status: 400 });
  }

  const { data: member, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !member?.id) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({ ok: false, message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const upload = await createGraduateVerificationSignedUpload({
      memberId,
      kind: "profile_image",
      contentType: body.contentType,
      size: body.size,
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    return NextResponse.json({ ok: true, upload });
  } catch {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json(
      { ok: false, message: "사진 업로드 URL을 발급하지 못했습니다. 다시 시도해 주세요." },
      { status: 400 },
    );
  }
}
