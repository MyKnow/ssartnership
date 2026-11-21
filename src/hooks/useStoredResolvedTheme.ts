"use client";

import { useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  resolveThemePreference,
  type ResolvedTheme,
} from "@/lib/theme-preference";

const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function getDarkColorSchemeQuery() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_COLOR_SCHEME_QUERY)
    : null;
}

function readStoredThemePreference() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // 저장소 접근이 막힌 브라우저(사생활 보호 모드 등)에서는 기본 테마를 쓴다.
    return null;
  }
}

function subscribe(onChange: () => void) {
  const query = getDarkColorSchemeQuery();
  window.addEventListener("storage", onChange);
  query?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    query?.removeEventListener("change", onChange);
  };
}

function getSnapshot(): ResolvedTheme {
  return resolveThemePreference(
    readStoredThemePreference(),
    getDarkColorSchemeQuery()?.matches ?? false,
  );
}

function getServerSnapshot(): ResolvedTheme {
  return resolveThemePreference(null, false);
}

/**
 * ThemeProvider 밖에서 자체 문서를 렌더하는 화면(`global-error`)이 사용자가 고른 테마를
 * 따르도록 next-themes와 같은 저장 키·기본값으로 해석한 테마를 돌려준다.
 * 서버·hydration 중에는 기본 테마를 돌려주고, 클라이언트에서 저장값으로 갱신한다.
 */
export function useStoredResolvedTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
