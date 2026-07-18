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
} from "@/lib/image-upload/repository.supabase";
import {
  isImageUploadBlocked,
  recordImageUploadAttempt,
} from "@/lib/image-upload/rate-limit";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 64 * 1024;

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    return null;
  }
  const text = await request.text().catch(() => "");
  if (!text || Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

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

  const parsed = parseImageUploadSignRequest(await readJsonBody(request));
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
  if (await isImageUploadBlocked("sign", rateLimitContext)) {
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
    return NextResponse.json(
      { ok: false, message: "이미지 업로드 URL을 발급하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
