"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

const subscribeHydrationState = () => () => {};
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

export default function ThemeModeButtons({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeHydrationState,
    getClientHydrationState,
    getServerHydrationState,
  );
  const activeTheme = mounted
    ? (resolvedTheme ?? (theme === "system" ? systemTheme : theme) ?? "light")
    : null;
  // 메뉴에서는 이름을 항상 보여 주고, 탐색 링크보다 낮은 대비로 선택 상태를 표시합니다.
  const activeText = compact ? "text-primary" : "text-primary-foreground";
  const inactiveText = compact ? "text-muted-foreground" : "text-foreground";
  const activeSurface = compact
    ? "absolute inset-0 rounded-lg border border-primary/15 bg-primary-soft shadow-flat"
    : "absolute inset-0 rounded-[1.05rem] bg-primary shadow-raised";

  return (
    <div role="group" aria-label="화면 모드" className={cn(
      "@container min-w-0 w-full border border-border/80 bg-surface-muted/90 p-1",
      compact ? "rounded-xl" : "rounded-[1.4rem] shadow-flat",
    )}>
      <div className="grid grid-cols-2">
        <button
          type="button"
          aria-label="라이트 모드"
          aria-pressed={activeTheme === "light"}
          onClick={() => setTheme("light")}
          className={cn(
            "relative flex min-h-11 items-center justify-center gap-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            compact ? "rounded-lg px-2 py-2" : "overflow-hidden rounded-[1.05rem] px-4 py-3",
            activeTheme === "light" ? activeText : inactiveText,
          )}
        >
          {activeTheme === "light" ? (
            <span
              aria-hidden="true"
              className={activeSurface}
            />
          ) : null}
          <SunIcon className="relative h-5 w-5 shrink-0 text-warning" />
          <span className={cn("relative whitespace-nowrap", !compact && "@max-[20rem]:hidden")}>
            {compact ? "라이트" : "라이트 모드"}
          </span>
        </button>
        <button
          type="button"
          aria-label="다크 모드"
          aria-pressed={activeTheme === "dark"}
          onClick={() => setTheme("dark")}
          className={cn(
            "relative flex min-h-11 items-center justify-center gap-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            compact ? "rounded-lg px-2 py-2" : "overflow-hidden rounded-[1.05rem] px-4 py-3",
            activeTheme === "dark" ? activeText : inactiveText,
          )}
        >
          {activeTheme === "dark" ? (
            <span
              aria-hidden="true"
              className={activeSurface}
            />
          ) : null}
          <MoonIcon
            className={cn(
              "relative h-5 w-5 shrink-0",
              activeTheme === "dark" && !compact ? "text-primary-foreground" : "text-primary",
            )}
          />
          <span className={cn("relative whitespace-nowrap", !compact && "@max-[20rem]:hidden")}>
            {compact ? "다크" : "다크 모드"}
          </span>
        </button>
      </div>
    </div>
  );
}
