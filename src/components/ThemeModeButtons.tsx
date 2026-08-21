"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

const subscribeHydrationState = () => () => {};
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

export default function ThemeModeButtons() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeHydrationState,
    getClientHydrationState,
    getServerHydrationState,
  );
  const activeTheme = mounted
    ? (resolvedTheme ?? (theme === "system" ? systemTheme : theme) ?? "light")
    : null;

  return (
    <div className="@container min-w-0 w-full rounded-[1.4rem] border border-border/80 bg-surface-muted/90 p-1 shadow-flat">
      <div className="grid grid-cols-2">
        <button
          type="button"
          aria-label="라이트 모드"
          aria-pressed={activeTheme === "light"}
          onClick={() => setTheme("light")}
          className={cn(
            "relative flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-[1.05rem] px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            activeTheme === "light" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {activeTheme === "light" ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[1.05rem] bg-primary shadow-raised"
            />
          ) : null}
          <SunIcon className="relative h-5 w-5 shrink-0 text-warning" />
          <span className="relative whitespace-nowrap @max-[20rem]:hidden">
            라이트 모드
          </span>
        </button>
        <button
          type="button"
          aria-label="다크 모드"
          aria-pressed={activeTheme === "dark"}
          onClick={() => setTheme("dark")}
          className={cn(
            "relative flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-[1.05rem] px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            activeTheme === "dark" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {activeTheme === "dark" ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[1.05rem] bg-primary shadow-raised"
            />
          ) : null}
          <MoonIcon
            className={cn(
              "relative h-5 w-5 shrink-0",
              activeTheme === "dark" ? "text-primary-foreground" : "text-primary",
            )}
          />
          <span className="relative whitespace-nowrap @max-[20rem]:hidden">
            다크 모드
          </span>
        </button>
      </div>
    </div>
  );
}
