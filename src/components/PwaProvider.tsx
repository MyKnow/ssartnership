"use client";

import { useEffect } from "react";

export default function PwaProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures silently; the app still works without PWA features.
    });
  }, []);

  return null;
}
