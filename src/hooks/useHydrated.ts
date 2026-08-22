"use client";

import { useSyncExternalStore } from "react";

const subscribeHydrationState = () => () => {};
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

export function useHydrated() {
  return useSyncExternalStore(
    subscribeHydrationState,
    getClientHydrationState,
    getServerHydrationState,
  );
}
