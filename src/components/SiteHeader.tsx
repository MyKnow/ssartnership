"use client";

import Link from "next/link";
import { BellIcon } from "@heroicons/react/24/outline";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import UserMenu from "@/components/auth/UserMenu";
import MobileNav from "@/components/MobileNav";
import type { HeaderSession } from "@/lib/header-session";
import { cn } from "@/lib/cn";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";

export default function SiteHeader({
  suggestHref = "/suggest",
  initialSession,
}: {
  suggestHref?: string;
  initialSession?: HeaderSession | null;
}) {
  const { hidden, headerHeight, headerRef } = useAutoHideHeader();

  return (
    <>
      <div
        aria-hidden="true"
        className="min-h-[calc(5rem+env(safe-area-inset-top))]"
        style={headerHeight ? { height: headerHeight } : undefined}
      />
      <header className="fixed inset-x-0 top-0 z-40">
      <div
        ref={headerRef}
        className={cn(
          "border-b border-border bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-300 ease-out will-change-transform",
          hidden ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <Container className="flex items-center justify-between gap-3 py-4">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center text-sm font-semibold uppercase tracking-[0.24em] text-foreground hover:opacity-80"
          >
            {SITE_NAME}
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" href={suggestHref}>
                제휴 제안하기
              </Button>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <UserMenu initialSession={initialSession} logoutIconOnly />
            </div>
            {initialSession ? (
              <div className="hidden sm:flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  href="/notifications"
                  ariaLabel="알림 설정"
                  title="알림 설정"
                >
                  <BellIcon className="h-5 w-5" />
                </Button>
              </div>
            ) : null}
            <div className="hidden sm:flex">
              <ThemeToggle />
            </div>
            <div className="sm:hidden">
              <ThemeToggle />
            </div>
            <MobileNav initialSession={initialSession} />
          </div>
        </Container>
      </div>
      </header>
    </>
  );
}
