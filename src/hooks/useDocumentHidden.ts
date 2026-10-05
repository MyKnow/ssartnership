"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** 탭이 백그라운드로 숨겨졌는지. 서버·hydration 중에는 `false`. */
export function useDocumentHidden() {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "hidden",
    () => false,
  );
}
