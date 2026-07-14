import { NextRequest, NextResponse } from 'next/server';
import {
  getRequestLogContext,
  resolveCurrentActor,
  scheduleProductEventLog,
} from '@/lib/activity-logs';
import {
  consumeProductEventIngressQuota,
  consumeProductEventQuota,
} from '@/lib/product-event-throttle';
import {
  MAX_PRODUCT_EVENT_BODY_BYTES,
  parseProductEventRequest,
} from '@/lib/product-event-contract';
import {
  RequestBodyTooLargeError,
  readRequestBodyWithinLimit,
} from '@/lib/request-body-limit';
import { isTrustedSameOriginRequest } from '@/lib/request-guards';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ['application/json'],
    })
  ) {
    return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 403 });
  }

  const declaredContentLength = request.headers.get('content-length');
  if (
    declaredContentLength &&
    Number.isFinite(Number(declaredContentLength)) &&
    Number(declaredContentLength) > MAX_PRODUCT_EVENT_BODY_BYTES
  ) {
    return NextResponse.json({ message: '이벤트 요청이 너무 큽니다.' }, { status: 413 });
  }

  const context = getRequestLogContext(request);
  if (!consumeProductEventIngressQuota({ ipAddress: context.ipAddress })) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  try {
    const rawBody = await readRequestBodyWithinLimit(
      request.body,
      MAX_PRODUCT_EVENT_BODY_BYTES,
    );
    const body = parseProductEventRequest(JSON.parse(rawBody) as unknown);

    if (
      !consumeProductEventQuota({
        eventName: body.eventName,
        ipAddress: context.ipAddress,
        sessionId: body.sessionId,
      })
    ) {
      return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
    }

    const actor = await resolveCurrentActor();

    scheduleProductEventLog({
      eventName: body.eventName,
      eventId: body.eventId,
      schemaVersion: body.schemaVersion,
      occurredAt: body.occurredAt,
      actorType: actor.actorType,
      actorId: actor.actorId,
      sessionId: body.sessionId ?? null,
      path: body.path ?? context.path,
      referrer: body.referrer ?? context.referrer,
      targetType: body.targetType ?? null,
      targetId: body.targetId ?? null,
      properties: body.properties ?? {},
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      requestId: context.requestId,
    });

    return NextResponse.json({ accepted: true, eventId: body.eventId }, { status: 202 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ message: '이벤트 요청이 너무 큽니다.' }, { status: 413 });
    }

    return NextResponse.json({ message: '이벤트를 기록하지 못했습니다.' }, { status: 400 });
  }
}
