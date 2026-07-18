"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BellIcon,
  IdentificationIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { BellAlertIcon } from "@heroicons/react/24/solid";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import type { HeaderSession } from "@/lib/header-session";
import { cn } from "@/lib/cn";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";
import BrandWordmark from "@/components/BrandWordmark";
import {
  NOTIFICATION_BELL_ACTIVE_ICON_CLASS,
  NOTIFICATION_BELL_ACTIVE_ICON_BUTTON_CLASS,
} from "@/components/notifications/notification-bell";
import {
  useNotificationUnreadCount,
} from "@/hooks/useNotificationUnreadCount";

const UserMenu = dynamic(() => import("@/components/auth/UserMenu"));
const MobileNav = dynamic(() => import("@/components/MobileNav"));

export default function SiteHeader({
  suggestHref = "/suggest",
  initialSession,
}: {
  suggestHref?: string;
  initialSession?: HeaderSession | null;
}) {
  const { hidden, headerHeight, headerRef } = useAutoHideHeader();
  const [notificationUnreadCount] = useNotificationUnreadCount(
    initialSession?.notificationUnreadCount ?? 0,
  );

  return (
    <>
      <div
        aria-hidden="true"
        className="min-safe-site-header"
        style={headerHeight ? { height: headerHeight } : undefined}
      />
      <header className="fixed inset-x-0 top-0 z-40">
        <div
          ref={headerRef}
          className={cn(
            "border-b border-border/70 bg-surface-overlay/95 pt-safe-top shadow-flat backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform",
            hidden ? "-translate-y-full" : "translate-y-0",
          )}
        >
          <Container className="flex min-w-0 items-center justify-between gap-3 py-3" size="wide">
            <Link
              href="/"
              aria-label={SITE_NAME}
              className="inline-flex min-h-11 shrink-0 items-center text-foreground transition-opacity hover:opacity-80"
            >
              <BrandWordmark className="text-lg sm:text-xl" />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden items-center gap-2 xl:flex">
                <Button variant="soft" href={suggestHref}>
                  제휴 제안하기
                </Button>
              </div>
              <div className="hidden items-center gap-2 xl:flex">
                <UserMenu initialSession={initialSession} logoutIconOnly />
              </div>
              {initialSession ? (
                <div className="relative hidden items-center xl:flex">
                  <Button
                    variant="secondary"
                    size="icon"
                    href="/notifications"
                    prefetch={false}
                    className={cn(
                      notificationUnreadCount > 0
                        ? NOTIFICATION_BELL_ACTIVE_ICON_BUTTON_CLASS
                        : null,
                    )}
                    ariaLabel="알림"
                    title="알림"
                  >
                    {notificationUnreadCount > 0 ? (
                      <BellAlertIcon
                        className={cn("h-5 w-5", NOTIFICATION_BELL_ACTIVE_ICON_CLASS)}
                      />
                    ) : (
                      <BellIcon className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : null}
              {initialSession ? (
                <div className="xl:hidden">
                  <Button
                    variant="secondary"
                    size="icon"
                    href="/certification"
                    prefetch={false}
                    ariaLabel="내 인증"
                    title="내 인증"
                  >
                    <IdentificationIcon className="h-5 w-5" />
                  </Button>
                </div>
              ) : null}
              <div className="flex">
                <ThemeToggle />
              </div>
              {initialSession ? (
                <div className="max-[359px]:hidden xl:hidden">
                  <Button
                    variant="secondary"
                    size="icon"
                    href="/coupons"
                    prefetch={false}
                    ariaLabel="쿠폰함"
                    title="쿠폰함"
                  >
                    <TicketIcon className="h-5 w-5" />
                  </Button>
                </div>
              ) : null}
              {initialSession ? (
                <div className="xl:hidden">
                  <Button
                    variant="secondary"
                    size="icon"
                    href="/notifications"
                    prefetch={false}
                    className={cn(
                      notificationUnreadCount > 0
                        ? NOTIFICATION_BELL_ACTIVE_ICON_BUTTON_CLASS
                        : null,
                    )}
                    ariaLabel="알림"
                    title="알림"
                  >
                    {notificationUnreadCount > 0 ? (
                      <BellAlertIcon
                        className={cn("h-5 w-5", NOTIFICATION_BELL_ACTIVE_ICON_CLASS)}
                      />
                    ) : (
                      <BellIcon className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : null}
              <MobileNav initialSession={initialSession} />
            </div>
          </Container>
        </div>
      </header>
    </>
  );
}
