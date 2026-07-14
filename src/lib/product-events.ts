'use client';

import type { ProductEventName } from '@/lib/event-catalog';
import { normalizeProductEventLocation } from '@/lib/product-event-path';
import { PRODUCT_EVENT_SCHEMA_VERSION } from '@/lib/product-event-schema';

type ProductEventClientPayload = {
  eventName: ProductEventName;
  path?: string | null;
  referrer?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
};

const SESSION_STORAGE_KEY = 'analytics:session-id';

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createSessionId() {
  return createUuid();
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
    eventId: createUuid(),
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
