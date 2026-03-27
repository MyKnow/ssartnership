"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/auth/UserMenu";
import { cn } from "@/lib/cn";

export default function MobileNav({ suggestHref }: { suggestHref: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return;
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-foreground sm:hidden"
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </svg>
      </button>

      {mounted && portalRoot
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[70] sm:hidden",
                open ? "pointer-events-auto" : "pointer-events-none"
              )}
              aria-hidden={!open}
            >
              <button
                type="button"
                className={cn(
                  "absolute inset-0 bg-black/55 transition-opacity",
                  open ? "opacity-100" : "opacity-0"
                )}
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              />
              <aside
                role="dialog"
                aria-modal="true"
                className={cn(
                  "fixed right-0 top-0 h-full w-[85vw] max-w-xs overflow-hidden rounded-l-3xl bg-surface transition-transform",
                  open ? "translate-x-0" : "translate-x-full"
                )}
              >
                <div className="flex h-full flex-col gap-5 border-l border-border/70 bg-surface px-6 py-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">메뉴</p>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground"
                      onClick={() => setOpen(false)}
                      aria-label="메뉴 닫기"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" href={suggestHref}>
                      제휴 제안하기
                    </Button>
                    <UserMenu />
                    <ThemeToggle />
                  </div>
                </div>
              </aside>
            </div>,
            portalRoot
          )
        : null}
    </>
  );
}
