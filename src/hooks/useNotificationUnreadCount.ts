"use client";

import { useEffect, useState } from "react";

const EVENT_NAME = "ssartnership:notification-unread-count-change";

export function emitNotificationUnreadCount(count: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { count },
    }),
  );
}

export function useNotificationUnreadCount(initialCount = 0) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setCount(Math.max(0, Math.trunc(detail.count)));
      }
    };

    window.addEventListener(EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(EVENT_NAME, handler as EventListener);
    };
  }, []);

  return [count, setCount] as const;
}
