'use client';

import type { ProductEventName } from '@/lib/event-catalog';
import { normalizeProductEventLocation } from '@/lib/product-event-path';

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
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
  if (typeof window === 'undefined') {
    return;
  }

  const path = normalizeProductEventLocation(
    payload.path ?? `${window.location.pathname}${window.location.search}`,
  );
  const referrer = normalizeProductEventLocation(
    payload.referrer ?? document.referrer ?? null,
  );

  const body = JSON.stringify({
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
