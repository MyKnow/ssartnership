'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackProductEvent } from '@/lib/product-events';
import { normalizeProductEventLocation } from '@/lib/product-event-path';

let previousTrackedPath: string | null = null;

export default function RoutePageViewTracker({
  area,
}: {
  area: 'site' | 'admin' | 'auth' | 'partner';
}) {
  const pathname = usePathname();
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    const path = normalizeProductEventLocation(pathname);
    if (!path || lastTrackedRef.current === path) {
      return;
    }
    lastTrackedRef.current = path;
    trackProductEvent({
      eventName: 'page_view',
      path,
      referrer: previousTrackedPath,
      properties: {
        area,
      },
    });
    previousTrackedPath = path;
  }, [area, pathname]);

  return null;
}
