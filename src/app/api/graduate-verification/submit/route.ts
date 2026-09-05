import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  getGraduateApplicationSession,
  hashGraduateEmailIdentifier,
} from "@/lib/graduate-verification-security";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import {
  GraduateVerificationServiceError,
  getVerifiedGraduateApplicationChallenge,
  submitGraduateVerificationRequest,
} from "@/lib/graduate-verification-service";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";

type GraduateSubmissionBody = {
  certificateUploadId?: unknown;
  profileImageUploadId?: unknown;
  profileImageUploadSource?: unknown;
  email?: unknown;
  legalName?: unknown;
  generation?: unknown;
  campus?: unknown;
  consented?: unknown;
};

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getGraduateApplicationSession();
  const challenge = session
    ? await getVerifiedGraduateApplicationChallenge(session.challengeId)
    : null;
  const sessionRequestKind = session?.requestKind ?? "graduate_signup";
  if (!session || !challenge || challenge.request_kind !== sessionRequestKind) {
    return NextResponse.json({ ok: false, message: "이메일 인증을 다시 진행해 주세요." }, { status: 401 });
  }
  const rateLimitContext = {
    route: "graduate-submission" as const,
    ipAddress: context.ipAddress,
    accountIdentifier: hashGraduateEmailIdentifier(challenge.email_normalized),
  };
  const blockingState = await isGraduateVerificationBlocked(rateLimitContext);
  if (!blockingState.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "제출 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
  if (blockingState.blocked) {
    return NextResponse.json({ ok: false, message: "제출 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: GraduateSubmissionBody | null = null;
  try {
    body = await readRouteJsonBodyWithinLimit<GraduateSubmissionBody>(request, {
      maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
      invalidMessage: "업로드 파일을 확인해 주세요.",
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
  if (
    !body ||
    typeof body !== "object" || Array.isArray(body) ||
    typeof body.email !== "string" || typeof body.legalName !== "string" ||
    (body.certificateUploadId !== undefined && typeof body.certificateUploadId !== "string") ||
    (body.profileImageUploadId !== undefined && typeof body.profileImageUploadId !== "string") ||
    (
      body.profileImageUploadSource !== undefined
      && body.profileImageUploadSource !== "common"
    ) ||
    (
      typeof body.profileImageUploadId === "string"
      && body.profileImageUploadSource !== "common"
    )
  ) {
    return NextResponse.json({ ok: false, message: "업로드 파일을 확인해 주세요." }, { status: 400 });
  }
  if (["educationStartYear", "educationStartMonth", "educationEndYear", "educationEndMonth", "education_start_year", "education_start_month", "education_end_year", "education_end_month"].some((key) => key in body)) {
    return NextResponse.json({ ok: false, message: "교육 정보 형식이 변경되었습니다. 페이지를 새로고침한 뒤 다시 제출해 주세요." }, { status: 400 });
  }
  try {
    const result = await submitGraduateVerificationRequest({
      challengeId: session.challengeId,
      certificateUploadId: typeof body.certificateUploadId === "string" ? body.certificateUploadId : null,
      profileImageUploadId: typeof body.profileImageUploadId === "string" ? body.profileImageUploadId : null,
      email: body.email,
      legalName: body.legalName,
      generation: body.generation,
      campus: typeof body.campus === "string" ? body.campus : null,
      consented: body.consented === true,
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_verification_submit",
      status: "success",
      actorType: "guest",
      properties: { inferredGeneration: result.inferredGeneration },
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    const serviceError = error instanceof GraduateVerificationServiceError ? error : null;
    await logAuthSecurity({
      ...context,
      eventName: "graduate_verification_submit",
      status: "failure",
      actorType: "guest",
      properties: { reason: serviceError?.code ?? "submission_failed" },
    });
    return NextResponse.json(
      {
        ok: false,
        message: serviceError?.message ?? "수료생 인증 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: serviceError?.code === "request_conflict" ? 409 : 400 },
    );
  }
}
