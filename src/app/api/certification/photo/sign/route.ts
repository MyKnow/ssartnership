import { NextResponse } from "next/server";
import { createGraduateVerificationSignedUpload } from "@/lib/graduate-verification-storage";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession } from "@/lib/user-auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

function isProfileImageContentType(value: unknown): value is "image/jpeg" | "image/png" | "image/webp" {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: member } = await getSupabaseAdminClient()
    .from("members")
    .select("graduate_verified_at")
    .eq("id", session.userId)
    .maybeSingle();
  if (!(member as { graduate_verified_at?: string | null } | null)?.graduate_verified_at) {
    return NextResponse.json({ ok: false, message: "수료생 인증이 완료된 계정만 본인 사진을 변경할 수 있습니다." }, { status: 403 });
  }

  const rateLimitContext = {
    route: "graduate-profile-photo-sign" as const,
    accountIdentifier: session.userId,
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "사진 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    contentType?: unknown;
    size?: unknown;
  } | null;
  if (!isProfileImageContentType(body?.contentType) || typeof body?.size !== "number") {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({ ok: false, message: "사진 업로드 요청을 확인해 주세요." }, { status: 400 });
  }
  try {
    const upload = await createGraduateVerificationSignedUpload({
      memberId: session.userId,
      kind: "profile_image",
      contentType: body.contentType,
      size: body.size,
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    return NextResponse.json({ ok: true, upload });
  } catch (error) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "사진 업로드 URL을 발급하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
