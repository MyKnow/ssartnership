"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import UserMenu from "@/components/auth/UserMenu";
import PwaInstallButton from "@/components/PwaInstallButton";
import Button from "@/components/ui/Button";
import type { HeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";

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

export default function MobileNav({
  initialSession,
}: {
  initialSession?: HeaderSession | null;
}) {
  const [open, setOpen] = useState(false);

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

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[70] sm:hidden",
                open ? "pointer-events-auto" : "pointer-events-none",
              )}
              aria-hidden={!open}
            >
              <button
                type="button"
                className={cn(
                  "absolute inset-0 bg-black/55 transition-opacity",
                  open ? "opacity-100" : "opacity-0",
                )}
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              />

              <aside
                role="dialog"
                aria-modal="true"
                className={cn(
                  "fixed right-0 top-0 h-full w-[86vw] max-w-sm overflow-hidden rounded-l-[2rem] border-l border-border bg-surface shadow-2xl transition-transform",
                  open ? "translate-x-0" : "translate-x-full",
                )}
              >
                <div className="flex h-full flex-col bg-surface">
                  <div className="border-b border-border px-6 pb-5 pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Menu
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {SITE_NAME}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground"
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
                      <DrawerSection
                        title="계정"
                        description="로그인, 회원가입, 프로필, 알림 관련 메뉴입니다."
                      >
                        {initialSession ? (
                          <Button
                            variant="ghost"
                            href="/notifications"
                            className="mb-2 w-full rounded-2xl px-4"
                          >
                            알림 설정
                          </Button>
                        ) : null}
                        <UserMenu
                          initialSession={initialSession}
                          className="flex-col items-stretch"
                          buttonClassName="w-full justify-between rounded-2xl px-4"
                        />
                      </DrawerSection>

                      <DrawerSection
                        title="앱"
                        description="홈 화면에 추가해 앱처럼 실행할 수 있습니다."
                      >
                        <PwaInstallButton className="w-full justify-between rounded-2xl px-4" />
                      </DrawerSection>
                    </div>
                  </div>

                  <div className="border-t border-border px-6 py-4">
                    <p className="text-xs text-muted-foreground">
                      화면 밖 영역을 누르거나 ESC 키를 누르면 드로어가 닫힙니다.
                    </p>
                  </div>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
