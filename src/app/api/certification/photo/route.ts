import { NextResponse } from "next/server";
import {
  GraduateVerificationServiceError,
  submitMemberProfileImageReplacement,
} from "@/lib/graduate-verification-service";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { requireMemberApiSession } from "@/lib/member-api-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { isUuidFormat } from "@/lib/uuid";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const auth = await requireMemberApiSession();
  if ("response" in auth) {
    return auth.response;
  }
  const { session } = auth;
  const rateLimitContext = {
    route: "member-profile-photo-submit" as const,
    accountIdentifier: session.userId,
  };
  const blockingState = await isGraduateVerificationBlocked(rateLimitContext);
  if (!blockingState.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "사진 변경 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
  if (blockingState.blocked) {
    return NextResponse.json({ ok: false, message: "사진 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  let body: {
    uploadId?: unknown;
    uploadSource?: unknown;
  } | null = null;
  try {
    body = await readRouteJsonBodyWithinLimit<{
      uploadId?: unknown;
      uploadSource?: unknown;
    }>(request, {
      maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
      invalidMessage: "사진 업로드를 확인해 주세요.",
      tooLargeMessage: "요청 본문이 너무 큽니다.",
    });
  } catch (error) {
    if (error instanceof RouteJsonBodyError && error.code === "body_too_large") {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
  }
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
  if (!isUuidFormat(uploadId) || body?.uploadSource !== "common") {
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
    console.error("[certification-photo] replacement failed", {
      code:
        error instanceof GraduateVerificationServiceError
          ? error.code
          : "unexpected_error",
    });
    const message =
      error instanceof GraduateVerificationServiceError
        ? error.message
        : "본인 사진 변경 요청을 저장하지 못했습니다.";
    return NextResponse.json({
      ok: false,
      message,
    }, { status: 400 });
  }
}
