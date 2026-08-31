'use client';

import type { ProductEventName } from '@/lib/event-catalog';
import { shouldBypassProductEventTransport } from '@/lib/activity-log-runtime';
import { normalizeProductEventLocation } from '@/lib/product-event-path';
import { PRODUCT_EVENT_SCHEMA_VERSION } from '@/lib/product-event-schema';
import { createClientUuid } from '@/lib/client-uuid';

type ProductEventClientPayload = {
  eventName: ProductEventName;
  path?: string | null;
  referrer?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
};

const SESSION_STORAGE_KEY = 'analytics:session-id';

function createSessionId() {
  return createClientUuid();
}

export function getProductSessionId() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const next = createSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

export function trackProductEvent(payload: ProductEventClientPayload) {
  if (
    typeof window === 'undefined' ||
    shouldBypassProductEventTransport({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
    })
  ) {
    return;
  }

  const path = normalizeProductEventLocation(
    payload.path ?? `${window.location.pathname}${window.location.search}`,
  );
  const referrer = normalizeProductEventLocation(
    payload.referrer ?? document.referrer ?? null,
  );

  const body = JSON.stringify({
    eventId: createClientUuid(),
    schemaVersion: PRODUCT_EVENT_SCHEMA_VERSION,
    occurredAt: new Date().toISOString(),
    sessionId: getProductSessionId(),
    path,
    referrer,
    targetType: payload.targetType ?? null,
    targetId: payload.targetId ?? null,
    properties: payload.properties ?? {},
    eventName: payload.eventName,
  });

  void fetch('/api/events/product', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => undefined);
}
