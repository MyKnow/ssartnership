import { NextResponse } from "next/server";
import {
  clearGraduateApplicationSession,
  getGraduateApplicationSession,
} from "@/lib/graduate-verification-security";
import {
  GraduateVerificationServiceError,
  withdrawGraduateVerificationRequest,
} from "@/lib/graduate-verification-service";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const session = await getGraduateApplicationSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "이메일 인증을 다시 진행해 주세요." }, { status: 401 });
  }
  try {
    const result = await withdrawGraduateVerificationRequest({
      challengeId: session.challengeId,
      requestKind: session.requestKind ?? "graduate_signup",
    });
    await clearGraduateApplicationSession();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const serviceError = error instanceof GraduateVerificationServiceError ? error : null;
    return NextResponse.json(
      {
        ok: false,
        message: serviceError?.message ?? "수료생 인증 신청을 철회하지 못했습니다.",
      },
      { status: serviceError?.code === "request_conflict" ? 409 : 400 },
    );
  }
}
