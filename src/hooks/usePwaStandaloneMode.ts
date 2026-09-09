"use client";

import { useSyncExternalStore } from "react";
import { getBrowserStandalonePwa } from "@/lib/pwa-install";

function subscribeStandaloneMode(onStoreChange: () => void) {
  const displayModeQuery = window.matchMedia("(display-mode: standalone)");
  displayModeQuery.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);

  return () => {
    displayModeQuery.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

export function usePwaStandaloneMode() {
  return useSyncExternalStore(
    subscribeStandaloneMode,
    getBrowserStandalonePwa,
    () => false,
  );
}
