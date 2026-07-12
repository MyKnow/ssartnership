import { NextResponse } from "next/server";
import { submitMemberProfileImageReplacement } from "@/lib/graduate-verification-service";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { getSignedUserSession } from "@/lib/user-auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const rateLimitContext = {
    route: "member-profile-photo-submit" as const,
    accountIdentifier: session.userId,
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "사진 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { uploadId?: unknown } | null;
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
  if (!UUID_PATTERN.test(uploadId)) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({ ok: false, message: "사진 업로드를 확인해 주세요." }, { status: 400 });
  }
  try {
    const result = await submitMemberProfileImageReplacement({
      memberId: session.userId,
      uploadId,
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "본인 사진 변경 요청을 저장하지 못했습니다.",
    }, { status: 400 });
  }
}
