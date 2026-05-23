import { NextRequest, NextResponse } from 'next/server';
import { isProductEventName } from '@/lib/event-catalog';
import {
  getRequestLogContext,
  resolveCurrentActor,
  scheduleProductEventLog,
} from '@/lib/activity-logs';
import { consumeProductEventQuota } from '@/lib/product-event-throttle';
import { normalizeProductEventLocation } from '@/lib/product-event-path';
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

  try {
    const body = (await request.json()) as {
      eventName?: string;
      sessionId?: string | null;
      path?: string | null;
      referrer?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      properties?: Record<string, unknown> | null;
    };

    if (!body?.eventName || !isProductEventName(body.eventName)) {
      return NextResponse.json({ message: '허용되지 않은 이벤트입니다.' }, { status: 400 });
    }

    const context = getRequestLogContext(request);
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
      actorType: actor.actorType,
      actorId: actor.actorId,
      sessionId: body.sessionId ?? null,
      path: normalizeProductEventLocation(body.path ?? context.path),
      referrer: normalizeProductEventLocation(body.referrer ?? context.referrer),
      targetType: body.targetType ?? null,
      targetId: body.targetId ?? null,
      properties: body.properties ?? {},
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ message: '이벤트를 기록하지 못했습니다.' }, { status: 400 });
  }
}
