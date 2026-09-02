"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  BellIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import UserMenu from "@/components/auth/UserMenu";
import Button from "@/components/ui/Button";
import type { HeaderSession } from "@/lib/header-session";
import { cn } from "@/lib/cn";
import { usePwaStandaloneMode } from "@/hooks/usePwaStandaloneMode";

const BROWSER_NAVIGATION_ITEMS = [
  { label: "홈", href: "/", Icon: HomeIcon, memberOnly: false },
  {
    label: "혜택 검색",
    href: "/#benefit-search",
    Icon: MagnifyingGlassIcon,
    memberOnly: false,
  },
  { label: "쿠폰함", href: "/coupons", Icon: TicketIcon, memberOnly: true },
  {
    label: "내 정보",
    href: "/certification",
    Icon: UserCircleIcon,
    memberOnly: true,
  },
] as const;

function DrawerSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-muted/70 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function TabletMenu({
  initialSession,
  guestAuthReturnTo,
}: {
  initialSession?: HeaderSession | null;
  guestAuthReturnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const standalone = usePwaStandaloneMode();
  const signedIn = Boolean(initialSession);

  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-site-browser-menu-trigger
        className={cn(
          "h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-control text-foreground xl:hidden",
          standalone ? "hidden md:inline-flex" : "inline-flex",
        )}
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

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 isolate z-[70] xl:hidden",
                standalone ? "hidden md:block" : "block",
                open ? "pointer-events-auto" : "pointer-events-none",
              )}
              aria-hidden={!open}
            >
              <button
                type="button"
                className={cn(
                  "absolute inset-0 z-0 bg-black/55 transition-opacity",
                  open ? "opacity-100" : "opacity-0",
                )}
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-label="메뉴"
                className={cn(
                  "fixed right-0 top-0 z-10 h-full w-[86vw] max-w-sm overflow-hidden rounded-l-[2rem] border-l border-border bg-surface-overlay shadow-overlay transition-transform",
                  open ? "translate-x-0" : "translate-x-full",
                )}
              >
                <div className="flex h-full flex-col bg-surface-overlay">
                  <div className="border-b border-border px-6 pb-5 pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Menu
                        </p>
                      </div>

                      <button
                        type="button"
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-control text-foreground"
                        onClick={() => setOpen(false)}
                        aria-label="메뉴 닫기"
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
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="flex flex-col gap-4">
                      <DrawerSection title="탐색">
                        <div className="grid gap-2">
                          {BROWSER_NAVIGATION_ITEMS.map((item) => {
                            const href =
                              item.memberOnly && !signedIn
                                ? `/auth/login?returnTo=${encodeURIComponent(item.href)}`
                                : item.href;
                            const Icon = item.Icon;

                            return (
                              <Button
                                key={item.label}
                                variant="ghost"
                                href={href}
                                prefetch={false}
                                onClick={() => setOpen(false)}
                                className="w-full justify-between rounded-2xl px-4"
                              >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                                {item.label}
                              </Button>
                            );
                          })}
                        </div>
                      </DrawerSection>

                      <DrawerSection title="계정">
                        {signedIn ? (
                          <Button
                            variant="ghost"
                            href="/notifications"
                            prefetch={false}
                            onClick={() => setOpen(false)}
                            className="mb-2 w-full justify-between rounded-2xl px-4"
                          >
                            <BellIcon className="h-5 w-5" aria-hidden="true" />
                            알림 설정
                          </Button>
                        ) : null}
                        <UserMenu
                          initialSession={initialSession}
                          guestAuthReturnTo={guestAuthReturnTo}
                          className="flex-col items-stretch"
                          buttonClassName="w-full justify-between rounded-2xl px-4"
                          showMemberNavigation={false}
                        />
                      </DrawerSection>

                    </div>
                  </div>

                  <div className="border-t border-border px-6 py-4">
                    <p className="text-xs text-muted-foreground">
                      화면 밖 영역을 누르거나 ESC 키를 누르면 드로어가 닫힙니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
