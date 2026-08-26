"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeSolidIcon,
  TicketIcon as TicketSolidIcon,
  UserCircleIcon as UserCircleSolidIcon,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";
import MobileNavGuestGate, {
  type MobileNavGuestDestination,
} from "@/components/MobileNavGuestGate";
import {
  isFocusedSiteFlow,
  isMyInfoPath,
  isPartnerDetailPath,
} from "@/lib/site-navigation";

const MOBILE_NAV_ITEMS = [
  {
    key: "home",
    label: "홈",
    href: "/",
    isActive: (pathname: string) => pathname === "/",
    Icon: HomeIcon,
    ActiveIcon: HomeSolidIcon,
  },
  {
    key: "coupons",
    label: "쿠폰함",
    href: "/coupons",
    isActive: (pathname: string) => pathname.startsWith("/coupons"),
    Icon: TicketIcon,
    ActiveIcon: TicketSolidIcon,
  },
  {
    key: "profile",
    label: "내 정보",
    href: "/certification",
    isActive: (pathname: string) => isMyInfoPath(pathname),
    Icon: UserCircleIcon,
    ActiveIcon: UserCircleSolidIcon,
  },
] as const;

function getMemberNavigationHref(
  href: "/coupons" | "/certification",
  signedIn: boolean,
) {
  if (signedIn) {
    return href;
  }

  return `/auth/login?returnTo=${encodeURIComponent(href)}`;
}

export default function MobileNav({
  signedInUserId,
}: {
  signedInUserId?: string | null;
}) {
  const pathname = usePathname();
  const isSignedIn = Boolean(signedInUserId);
  const [guestDestination, setGuestDestination] =
    useState<MobileNavGuestDestination | null>(null);
  if (isFocusedSiteFlow(pathname) || isPartnerDetailPath(pathname)) {
    return null;
  }

  const handleSearchClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") {
      return;
    }

    const searchInput = document.querySelector<HTMLInputElement>(
      "[data-testid='partner-search-input']",
    );
    if (!searchInput) {
      return;
    }

    event.preventDefault();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#benefit-search`,
    );
    searchInput.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });
    window.requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
  };

  return (
    <>
      <nav
        aria-label="모바일 주요 탐색"
        data-site-mobile-navigation
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 px-3 md:hidden"
      >
        <div className="mx-auto flex w-full max-w-md items-stretch gap-2">
          <div className="site-mobile-nav-glass pointer-events-auto grid min-w-0 flex-1 grid-cols-3 rounded-[2.125rem] p-1">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              const Icon = active ? item.ActiveIcon : item.Icon;
              const href =
                item.href === "/coupons" || item.href === "/certification"
                  ? getMemberNavigationHref(item.href, isSignedIn)
                  : item.href;
              const guestOnlyDestination =
                item.key === "coupons" || item.key === "profile"
                  ? item.key
                  : null;

              return (
                <Link
                  key={item.key}
                  href={href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  aria-haspopup={
                    !isSignedIn && guestOnlyDestination ? "dialog" : undefined
                  }
                  aria-expanded={
                    !isSignedIn && guestOnlyDestination
                      ? guestDestination === guestOnlyDestination
                      : undefined
                  }
                  onClick={(event) => {
                    if (isSignedIn || !guestOnlyDestination) {
                      return;
                    }
                    event.preventDefault();
                    setGuestDestination(guestOnlyDestination);
                  }}
                  className={cn(
                    "site-mobile-nav-interactive flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.75rem] px-1 text-[11px] font-semibold leading-none text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                    active && "site-mobile-nav-active text-primary-emphasis",
                  )}
                >
                  <Icon className="h-[1.375rem] w-[1.375rem]" aria-hidden="true" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <Link
            href="/#benefit-search"
            prefetch={false}
            onClick={handleSearchClick}
            aria-label="혜택 검색"
            className="site-mobile-nav-glass site-mobile-nav-interactive pointer-events-auto flex h-[4.25rem] w-[4.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MagnifyingGlassIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-none">검색</span>
          </Link>
        </div>
      </nav>
      <MobileNavGuestGate
        destination={guestDestination}
        onClose={() => setGuestDestination(null)}
      />
    </>
  );
}
