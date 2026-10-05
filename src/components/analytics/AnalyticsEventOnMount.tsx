'use client';

import { useEffect, useMemo } from 'react';
import type { ClientProductEventName } from '@/lib/product-event-contract';
import { trackProductEvent } from '@/lib/product-events';

const recentEventKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 1500;

export default function AnalyticsEventOnMount({
  eventName,
  targetType,
  targetId,
  properties,
  path,
  dedupeKey,
}: {
  eventName: ClientProductEventName;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
  path?: string | null;
  dedupeKey?: string;
}) {
  const key = useMemo(
    () =>
      dedupeKey ??
      JSON.stringify({
        eventName,
        targetType,
        targetId,
        path,
        properties: properties ?? {},
      }),
    [dedupeKey, eventName, path, properties, targetId, targetType],
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
      path,
      properties: properties ?? {},
    });
  }, [eventName, key, path, properties, targetId, targetType]);

  return null;
}
