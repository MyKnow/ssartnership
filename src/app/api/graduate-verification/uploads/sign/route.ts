import { NextResponse } from "next/server";
import { getRequestLogContext } from "@/lib/activity-logs";
import { hashGraduateEmailIdentifier } from "@/lib/graduate-verification-security";
import { createGraduateVerificationSignedUpload, type GraduateUploadKind } from "@/lib/graduate-verification-storage";
import { getGraduateApplicationSession } from "@/lib/graduate-verification-security";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { getVerifiedGraduateApplicationChallenge } from "@/lib/graduate-verification-service";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

function isGraduateUploadKind(value: unknown): value is GraduateUploadKind {
  return value === "certificate" || value === "profile_image";
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getGraduateApplicationSession();
  const challenge = session
    ? await getVerifiedGraduateApplicationChallenge(session.challengeId)
    : null;
  if (
    !session ||
    !challenge ||
    challenge.request_kind !== (session.requestKind ?? "graduate_signup")
  ) {
    return NextResponse.json({ ok: false, message: "이메일 인증을 다시 진행해 주세요." }, { status: 401 });
  }
  const rateLimitContext = {
    route: "graduate-upload-sign" as const,
    ipAddress: context.ipAddress,
    accountIdentifier: hashGraduateEmailIdentifier(challenge.email_normalized),
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "사진·수료증 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    contentType?: unknown;
    size?: unknown;
  } | null;
  if (
    !isGraduateUploadKind(body?.kind) ||
    typeof body?.contentType !== "string" ||
    typeof body?.size !== "number"
  ) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json({ ok: false, message: "업로드 요청을 확인해 주세요." }, { status: 400 });
  }
  try {
    const upload = await createGraduateVerificationSignedUpload({
      challengeId: session.challengeId,
      kind: body.kind,
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
        message: error instanceof Error ? error.message : "업로드 URL을 발급하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
