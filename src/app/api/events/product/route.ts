import { NextRequest, NextResponse } from 'next/server';
import { isProductEventName } from '@/lib/event-catalog';
import {
  getRequestLogContext,
  logProductEvent,
  resolveCurrentActor,
} from '@/lib/activity-logs';
import { normalizeProductEventLocation } from '@/lib/product-event-path';

export const runtime = 'nodejs';

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
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

    const actor = await resolveCurrentActor();
    const context = getRequestLogContext(request);

    await logProductEvent({
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: '이벤트를 기록하지 못했습니다.' }, { status: 400 });
  }
}
