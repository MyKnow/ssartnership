'use client';

import type { ProductEventName } from '@/lib/event-catalog';
import { trackProductEvent } from '@/lib/product-events';

export default function TrackedAnchor({
  href,
  className,
  target,
  rel,
  ariaLabel,
  title,
  eventName,
  targetType,
  targetId,
  properties,
  children,
}: {
  href: string;
  className?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  title?: string;
  eventName: ProductEventName;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      title={title}
      onClick={() => {
        trackProductEvent({
          eventName,
          targetType: targetType ?? null,
          targetId: targetId ?? null,
          properties: properties ?? {},
        });
      }}
    >
      {children}
    </a>
  );
}
