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

export const runtime = "nodejs";

type GraduateSubmissionBody = {
  certificateUploadId?: unknown;
  profileImageUploadId?: unknown;
  profileImageUploadSource?: unknown;
  email?: unknown;
  legalName?: unknown;
  educationStartYear?: unknown;
  educationStartMonth?: unknown;
  educationEndYear?: unknown;
  educationEndMonth?: unknown;
  campus?: unknown;
  consented?: unknown;
};

function toInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
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
  const sessionRequestKind = session?.requestKind ?? "graduate_signup";
  if (!session || !challenge || challenge.request_kind !== sessionRequestKind) {
    return NextResponse.json({ ok: false, message: "이메일 인증을 다시 진행해 주세요." }, { status: 401 });
  }
  const rateLimitContext = {
    route: "graduate-submission" as const,
    ipAddress: context.ipAddress,
    accountIdentifier: hashGraduateEmailIdentifier(challenge.email_normalized),
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "제출 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as GraduateSubmissionBody | null;
  if (
    !body ||
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
  try {
    const result = await submitGraduateVerificationRequest({
      challengeId: session.challengeId,
      certificateUploadId: typeof body.certificateUploadId === "string" ? body.certificateUploadId : null,
      profileImageUploadId: typeof body.profileImageUploadId === "string" ? body.profileImageUploadId : null,
      email: String(body.email ?? ""),
      legalName: String(body.legalName ?? ""),
      educationStartYear: toInteger(body.educationStartYear),
      educationStartMonth: toInteger(body.educationStartMonth),
      educationEndYear: toInteger(body.educationEndYear),
      educationEndMonth: toInteger(body.educationEndMonth),
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
