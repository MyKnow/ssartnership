import { NextRequest, NextResponse } from "next/server";
import {
  getRequestLogContext,
  scheduleProductEventLog,
} from "@/lib/activity-logs";
import { consumeProductEventQuota } from "@/lib/product-event-throttle";
import {
  PartnerBenefitUsageError,
  recordPartnerBenefitUsage,
} from "@/lib/partner-benefit-usage-service";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 4 * 1024;

type BenefitUseRequestBody = {
  benefit?: unknown;
  pin?: unknown;
  idempotencyKey?: unknown;
  sessionId?: unknown;
};

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return "";
  }
}

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 128) : null;
}

function getStatusForCode(code: PartnerBenefitUsageErrorCode) {
  switch (code) {
    case "partner_not_found":
      return 404;
    case "pin_not_configured":
      return 503;
    case "pin_invalid":
    case "benefit_not_found":
    case "benefit_unavailable":
    case "idempotency_conflict":
      return 409;
  }
}

type PartnerBenefitUsageErrorCode =
  | "partner_not_found"
  | "benefit_unavailable"
  | "benefit_not_found"
  | "pin_not_configured"
  | "pin_invalid"
  | "idempotency_conflict";

function getMessageForCode(code: PartnerBenefitUsageErrorCode) {
  switch (code) {
    case "partner_not_found":
      return "제휴처를 찾을 수 없습니다.";
    case "benefit_unavailable":
      return "현재 이용할 수 없는 혜택입니다.";
    case "benefit_not_found":
      return "선택한 혜택을 확인할 수 없습니다.";
    case "pin_not_configured":
      return "제휴처의 혜택 확인 PIN이 아직 설정되지 않았습니다.";
    case "pin_invalid":
      return "제휴처 확인 PIN이 올바르지 않습니다.";
    case "idempotency_conflict":
      return "이미 처리된 이용 확인 요청입니다. 화면을 새로고침해 주세요.";
  }
}

function scheduleAttemptLog(
  context: ReturnType<typeof getRequestLogContext>,
  input: {
    actorId: string;
    partnerId: string;
    sessionId: string | null;
    result: "success" | "failure";
    reasonCode?: string;
  },
) {
  scheduleProductEventLog({
    ...context,
    actorType: "member",
    actorId: input.actorId,
    sessionId: input.sessionId,
    eventName: "partner_benefit_use_pin_attempt",
    targetType: "partner",
    targetId: input.partnerId,
    properties: {
      result: input.result,
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    },
  });
  if (input.result === "failure") {
    scheduleProductEventLog({
      ...context,
      actorType: "member",
      actorId: input.actorId,
      sessionId: input.sessionId,
      eventName: "partner_benefit_use_failure",
      targetType: "partner",
      targetId: input.partnerId,
      properties: {
        reasonCode: input.reasonCode ?? "unknown",
      },
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const partnerId = safeDecodeSegment((await params).id ?? "");
  if (!UUID_PATTERN.test(partnerId)) {
    return NextResponse.json({ ok: false, message: "제휴처 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "요청이 너무 큽니다." }, { status: 413 });
  }

  let body: BenefitUseRequestBody;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_body");
    }
    body = parsed as BenefitUseRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const context = getRequestLogContext(request);
  const sessionId = normalizeSessionId(body.sessionId);
  if (!consumeProductEventQuota({
    eventName: "partner_benefit_use_pin_attempt",
    ipAddress: context.ipAddress,
    sessionId,
  })) {
    return NextResponse.json(
      { ok: false, message: "요청이 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  if (typeof body.benefit !== "string" || body.benefit.trim().length === 0 || body.benefit.length > 500) {
    scheduleAttemptLog(context, {
      actorId: session.userId,
      partnerId,
      sessionId,
      result: "failure",
      reasonCode: "benefit_invalid",
    });
    return NextResponse.json({ ok: false, message: "혜택 정보를 확인해 주세요." }, { status: 400 });
  }
  if (typeof body.pin !== "string" || !/^\d{4}$/.test(body.pin)) {
    scheduleAttemptLog(context, {
      actorId: session.userId,
      partnerId,
      sessionId,
      result: "failure",
      reasonCode: "pin_invalid_format",
    });
    return NextResponse.json({ ok: false, message: "제휴처 확인 PIN은 숫자 4자리로 입력해 주세요." }, { status: 400 });
  }
  if (typeof body.idempotencyKey !== "string" || !UUID_PATTERN.test(body.idempotencyKey)) {
    scheduleAttemptLog(context, {
      actorId: session.userId,
      partnerId,
      sessionId,
      result: "failure",
      reasonCode: "idempotency_key_invalid",
    });
    return NextResponse.json({ ok: false, message: "요청 식별자를 확인해 주세요." }, { status: 400 });
  }

  try {
    const result = await recordPartnerBenefitUsage({
      partnerId,
      memberId: session.userId,
      benefit: body.benefit,
      pin: body.pin,
      idempotencyKey: body.idempotencyKey,
      metadata: {
        path: context.path,
        userAgent: context.userAgent,
      },
    });

    scheduleAttemptLog(context, {
      actorId: session.userId,
      partnerId,
      sessionId,
      result: "success",
    });
    scheduleProductEventLog({
      ...context,
      actorType: "member",
      actorId: session.userId,
      sessionId,
      eventName: "partner_benefit_use_success",
      targetType: "partner",
      targetId: partnerId,
      properties: { benefitLength: result.benefitSnapshot.length },
    });
    if (result.isNew) {
      scheduleProductEventLog({
        ...context,
        actorType: "member",
        actorId: session.userId,
        sessionId,
        eventName: "partner_benefit_use",
        targetType: "partner",
        targetId: partnerId,
        properties: { source: "partner_verification" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartnerBenefitUsageError) {
      scheduleAttemptLog(context, {
        actorId: session.userId,
        partnerId,
        sessionId,
        result: "failure",
        reasonCode: error.code,
      });
      return NextResponse.json(
        { ok: false, message: getMessageForCode(error.code) },
        { status: getStatusForCode(error.code) },
      );
    }

    console.error("[partner-benefit-use] failed", error);
    scheduleAttemptLog(context, {
      actorId: session.userId,
      partnerId,
      sessionId,
      result: "failure",
      reasonCode: "service_unavailable",
    });
    return NextResponse.json(
      { ok: false, message: "혜택 이용 확인에 실패했습니다." },
      { status: 503 },
    );
  }
}
