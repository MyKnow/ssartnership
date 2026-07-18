import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext } from "@/lib/activity-logs";
import {
  IMAGE_UPLOAD_GUEST_COOKIE,
  ImageUploadAuthorizationError,
  imageUploadActorIdentifier,
  resolveImageUploadActorForRoute,
} from "@/lib/image-upload/auth.server";
import { parseImageUploadCompleteRequest } from "@/lib/image-upload/http";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import {
  isImageUploadBlocked,
  recordImageUploadAttempt,
} from "@/lib/image-upload/rate-limit";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 32 * 1024;

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

export async function POST(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }

  const parsed = parseImageUploadCompleteRequest(await readJsonBody(request));
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
  if (await isImageUploadBlocked("complete", rateLimitContext)) {
    return NextResponse.json(
      { ok: false, message: "사진 처리 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  try {
    const uploads = await getImageUploadRepository().complete({
      actor: actorResult.actor,
      purpose: parsed.purpose,
      uploadIds: parsed.uploadIds,
    });
    await recordImageUploadAttempt("complete", { ...rateLimitContext, success: true });
    return NextResponse.json({ ok: true, uploads });
  } catch (error) {
    await recordImageUploadAttempt("complete", { ...rateLimitContext, success: false });
    console.error("[image-upload/complete]", {
      purpose: parsed.purpose,
      actor: actorResult.actor.kind,
      error: error instanceof Error ? error.message : "unknown",
    });
    const isProcessing = error instanceof Error && error.message.includes("처리 중");
    return NextResponse.json(
      {
        ok: false,
        code: isProcessing ? "upload_processing" : "upload_complete_failed",
        message: isProcessing
          ? "이미지를 처리 중입니다. 잠시 후 자동으로 다시 확인합니다."
          : "이미지를 처리하지 못했습니다. 이미지를 다시 선택해 주세요.",
      },
      { status: isProcessing ? 409 : 422 },
    );
  }
}
