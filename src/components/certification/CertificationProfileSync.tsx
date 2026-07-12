"use client";

import { useEffect } from "react";

const PROFILE_SYNC_KEY = "certification-profile-sync";
const SYNC_DELAY_MS = 1000;
const recentSyncStarts = new Map<string, number>();
const SYNC_DEDUPE_WINDOW_MS = 5000;

function shouldSkipSync(key: string) {
  const now = Date.now();
  const previous = recentSyncStarts.get(key) ?? 0;
  if (now - previous < SYNC_DEDUPE_WINDOW_MS) {
    return true;
  }
  recentSyncStarts.set(key, now);
  return false;
}

export default function CertificationProfileSync({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled || shouldSkipSync(PROFILE_SYNC_KEY)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetch("/api/mm/profile-sync", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    }, SYNC_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return null;
}
