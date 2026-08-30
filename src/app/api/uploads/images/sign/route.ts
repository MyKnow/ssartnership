import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext } from "@/lib/activity-logs";
import {
  IMAGE_UPLOAD_GUEST_COOKIE,
  IMAGE_UPLOAD_GUEST_COOKIE_MAX_AGE_SECONDS,
  ImageUploadAuthorizationError,
  imageUploadActorIdentifier,
  resolveImageUploadActorForRoute,
} from "@/lib/image-upload/auth.server";
import { parseImageUploadSignRequest } from "@/lib/image-upload/http";
import {
  getImageUploadRepository,
  getSignedImageUploadHeaders,
} from "@/lib/image-upload/repository.server";
import { ImageUploadError } from "@/lib/image-upload/repository";
import {
  isImageUploadBlocked,
  recordImageUploadAttempt,
} from "@/lib/image-upload/rate-limit";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 64 * 1024;

function applyGuestCookie(response: NextResponse, guestOwnerToSet?: string) {
  if (!guestOwnerToSet) return response;
  response.cookies.set({
    name: IMAGE_UPLOAD_GUEST_COOKIE,
    value: guestOwnerToSet,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: IMAGE_UPLOAD_GUEST_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await readRouteJsonBodyWithinLimit<unknown>(request, {
      maximumBytes: MAX_JSON_BYTES,
      invalidMessage: "이미지 업로드 요청을 확인해 주세요.",
      tooLargeMessage: "이미지 업로드 요청이 너무 큽니다.",
    });
  } catch (error) {
    if (error instanceof RouteJsonBodyError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  const parsed = parseImageUploadSignRequest(body);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, message: "이미지 업로드 요청을 확인해 주세요." },
      { status: 400 },
    );
  }

  let actorResult: Awaited<ReturnType<typeof resolveImageUploadActorForRoute>>;
  try {
    actorResult = await resolveImageUploadActorForRoute({
      purpose: parsed.purpose,
      actorMode: parsed.actorMode,
      guestOwner: request.cookies.get(IMAGE_UPLOAD_GUEST_COOKIE)?.value,
    });
  } catch (error) {
    if (error instanceof ImageUploadAuthorizationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, message: "인증 정보를 확인해 주세요." }, { status: 401 });
  }

  const rateLimitContext = {
    ipAddress: getRequestLogContext(request).ipAddress,
    accountIdentifier: imageUploadActorIdentifier(actorResult.actor),
  };
  const blockingState = await isImageUploadBlocked("sign", rateLimitContext);
  if (!blockingState.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "이미지 업로드 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
  if (blockingState.blocked) {
    return NextResponse.json(
      { ok: false, message: "사진 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  try {
    const uploads = await getImageUploadRepository().sign({
      actor: actorResult.actor,
      purpose: parsed.purpose,
      uploads: parsed.uploads,
    });
    await recordImageUploadAttempt("sign", { ...rateLimitContext, success: true });
    return applyGuestCookie(
      NextResponse.json({
        ok: true,
        uploads,
        uploadHeaders: getSignedImageUploadHeaders(),
      }),
      actorResult.guestOwnerToSet,
    );
  } catch (error) {
    await recordImageUploadAttempt("sign", { ...rateLimitContext, success: false });
    console.error("[image-upload/sign]", {
      purpose: parsed.purpose,
      actor: actorResult.actor.kind,
      error: error instanceof Error ? error.message : "unknown",
    });
    const isUnavailable = error instanceof ImageUploadError
      && error.code === "image_upload_unavailable";
    return NextResponse.json(
      {
        ok: false,
        code: isUnavailable ? "image_upload_unavailable" : "upload_sign_failed",
        message: isUnavailable
          ? "현재 환경에서는 이미지 업로드를 사용할 수 없습니다."
          : "이미지 업로드 URL을 발급하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
