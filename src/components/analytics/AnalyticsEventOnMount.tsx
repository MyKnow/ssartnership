'use client';

import { useEffect, useMemo } from 'react';
import type { ProductEventName } from '@/lib/event-catalog';
import { trackProductEvent } from '@/lib/product-events';

const recentEventKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 1500;

export default function AnalyticsEventOnMount({
  eventName,
  targetType,
  targetId,
  properties,
  dedupeKey,
}: {
  eventName: ProductEventName;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
  dedupeKey?: string;
}) {
  const key = useMemo(
    () =>
      dedupeKey ??
      JSON.stringify({ eventName, targetType, targetId, properties: properties ?? {} }),
    [dedupeKey, eventName, properties, targetId, targetType],
  );

  useEffect(() => {
    const now = Date.now();
    const previous = recentEventKeys.get(key) ?? 0;
    if (now - previous < DEDUPE_WINDOW_MS) {
      return;
    }
    recentEventKeys.set(key, now);
    trackProductEvent({
      eventName,
      targetType,
      targetId,
      properties: properties ?? {},
    });
  }, [eventName, key, properties, targetId, targetType]);

  return null;
}
