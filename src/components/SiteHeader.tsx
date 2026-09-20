"use client";

import Link from "next/link";
import {
  BellIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { usePathname } from "next/navigation";
import { BellAlertIcon } from "@heroicons/react/24/solid";
import TabletMenu from "@/components/TabletMenu";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import type { HeaderSession } from "@/lib/header-session";
import { cn } from "@/lib/cn";
import BrandWordmark from "@/components/BrandWordmark";
import {
  NOTIFICATION_BELL_ACTIVE_ICON_CLASS,
} from "@/components/notifications/notification-bell";
import {
  useNotificationUnreadCount,
} from "@/hooks/useNotificationUnreadCount";
import { isFocusedSiteFlow } from "@/lib/site-navigation";

export default function SiteHeader({
  suggestHref = "/suggest",
  initialSession,
  guestAuthReturnTo,
}: {
  suggestHref?: string;
  initialSession?: HeaderSession | null;
  guestAuthReturnTo?: string;
}) {
  const pathname = usePathname();
  const [notificationUnreadCount] = useNotificationUnreadCount(
    initialSession?.notificationUnreadCount ?? 0,
  );

  const handleSearchClick = (event: React.MouseEvent<HTMLElement>) => {
    if (pathname !== "/" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const input = document.querySelector<HTMLInputElement>("#benefit-search");
    if (!input) return;
    event.preventDefault();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#benefit-search`,
    );
    // 터치 이벤트 안에서 바로 포커스해야 iOS에서도 검색 키보드가 열립니다.
    input.focus({ preventScroll: true });
    input.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="safe-site-header-spacer"
      />
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="border-b border-border/70 bg-surface-overlay/95 pt-safe-top shadow-flat backdrop-blur-xl">
          <Container className="flex min-w-0 items-center justify-between gap-3 py-3" size="wide">
            <Link
              href="/"
              aria-label={SITE_NAME}
              className="inline-flex min-h-11 shrink-0 items-center text-foreground transition-opacity hover:opacity-80"
            >
              <BrandWordmark className="text-lg sm:text-xl" />
            </Link>
            <div data-site-header-actions className="flex shrink-0 items-center gap-1 sm:gap-2">
              {initialSession ? (
                <div data-site-header-certification>
                  <Button
                    variant="soft"
                    href="/certification"
                    prefetch={false}
                    className="px-3 !shadow-none focus-visible:!outline-2 focus-visible:!outline-primary focus-visible:!outline-offset-2 sm:px-4"
                    ariaCurrent={pathname === "/certification" ? "page" : undefined}
                  >
                    내 인증
                  </Button>
                </div>
              ) : !isFocusedSiteFlow(pathname) ? (
                <div data-site-header-search>
                  <Button
                    href="/#benefit-search"
                    prefetch={false}
                    variant="ghost"
                    size="icon"
                    ariaLabel="혜택 검색"
                    title="혜택 검색"
                    onClick={handleSearchClick}
                  >
                    <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
              {initialSession ? (
                <Button
                  variant="ghost"
                  size="icon"
                  href="/notifications"
                  prefetch={false}
                  className="relative"
                  ariaLabel="알림"
                  title={notificationUnreadCount > 0 ? `읽지 않은 알림 ${notificationUnreadCount}개` : "알림"}
                >
                  {notificationUnreadCount > 0 ? (
                    <>
                      <BellAlertIcon
                        className={cn("h-5 w-5 text-danger", NOTIFICATION_BELL_ACTIVE_ICON_CLASS)}
                        aria-hidden="true"
                      />
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
                      <span className="sr-only">읽지 않은 알림 {notificationUnreadCount}개</span>
                    </>
                  ) : (
                    <BellIcon className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>
              ) : null}
              <TabletMenu
                initialSession={initialSession}
                guestAuthReturnTo={guestAuthReturnTo}
                suggestHref={suggestHref}
              />
            </div>
          </Container>
        </div>
      </header>
    </>
  );
}
