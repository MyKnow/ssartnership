"use client";

import { motion } from "framer-motion";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

export default function ThemeModeButtons() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();
  const activeTheme =
    resolvedTheme ?? (theme === "system" ? systemTheme : theme) ?? "light";

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
            <motion.span
              layoutId="theme-mode-active-pill"
              className="absolute inset-0 rounded-[1.05rem] bg-primary shadow-raised"
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
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
            <motion.span
              layoutId="theme-mode-active-pill"
              className="absolute inset-0 rounded-[1.05rem] bg-primary shadow-raised"
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
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
