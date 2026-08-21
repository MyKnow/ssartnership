"use client";

import { useEffect } from "react";

export default function PwaProvider() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures silently; the app still works without PWA features.
    });
  }, []);

  return null;
}
