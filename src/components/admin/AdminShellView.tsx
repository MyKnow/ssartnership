"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import { PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME } from "@/components/portal-v2/portal-v2-classes";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import AdminQuickNavigatorProvider, {
  AdminQuickNavigatorTrigger,
} from "@/components/admin/AdminQuickNavigator";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";
import {
  ADMIN_PREFETCH_HOVER_DELAY_MS,
  markAdminPrefetchIntent,
} from "@/lib/admin-prefetch";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import {
  ADMIN_NAV_ICON_BY_KEY,
  type AdminNavGroup,
  findAdminNavItem,
  getAdminMobileNavigation,
  isAdminNavActive,
} from "@/components/admin/admin-navigation";
import { useHydrated } from "@/hooks/useHydrated";

const AdminMobileNav = dynamic(() => import("@/components/admin/AdminMobileNav"));
const AdminLogoutButton = dynamic(() => import("@/components/admin/AdminLogoutButton"));

export type AdminLogoutAction = (formData: FormData) => void | Promise<void>;

export default function AdminShellView({
  title,
  backHref,
  backLabel,
  children,
  logoutAction,
  navGroups,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  logoutAction: AdminLogoutAction;
  navGroups: AdminNavGroup[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const prefetchedHrefsRef = useRef(new Set<string>());
  const hoverPrefetchTimersRef = useRef(new Map<string, number>());
  const [isTabletNavExpanded, setIsTabletNavExpanded] = useState(false);
  const { headerHeight, headerRef } = useHeaderHeight();
  const activeNavItem =
    navGroups
      .flatMap((group) => group.items)
      .find((item) => isAdminNavActive(pathname, item.href)) ??
    findAdminNavItem(pathname);
  const mobileNavEntries = getAdminMobileNavigation(navGroups);
  const mobileNavItemClassName = (active: boolean) =>
    cn(
      "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );
  const skipLinkClassName =
    "sr-only fixed left-4 top-4 z-[90] rounded-control border border-border bg-surface-overlay px-4 py-3 text-sm font-semibold text-foreground shadow-overlay focus:not-sr-only focus:!fixed focus:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const requestPrefetch = useCallback((href: string, trigger: "hover" | "focus") => {
    if (
      prefetchedHrefsRef.current.has(href) ||
      !markAdminPrefetchIntent(href, trigger)
    ) {
      return;
    }
    prefetchedHrefsRef.current.add(href);
    router.prefetch(href);
  }, [router]);
  const prefetchOnIntent = useCallback((href: string, trigger: "hover" | "focus") => {
    if (trigger === "hover") {
      if (hoverPrefetchTimersRef.current.has(href)) {
        return;
      }
      const timer = window.setTimeout(() => {
        hoverPrefetchTimersRef.current.delete(href);
        requestPrefetch(href, "hover");
      }, ADMIN_PREFETCH_HOVER_DELAY_MS);
      hoverPrefetchTimersRef.current.set(href, timer);
      return;
    }

    const timer = hoverPrefetchTimersRef.current.get(href);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      hoverPrefetchTimersRef.current.delete(href);
    }
    requestPrefetch(href, "focus");
  }, [requestPrefetch]);
  const cancelHoverPrefetch = useCallback((href: string) => {
    const timer = hoverPrefetchTimersRef.current.get(href);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      hoverPrefetchTimersRef.current.delete(href);
    }
  }, []);

  useEffect(() => {
    const hoverPrefetchTimers = hoverPrefetchTimersRef.current;
    return () => {
      for (const timer of hoverPrefetchTimers.values()) {
        window.clearTimeout(timer);
      }
      hoverPrefetchTimers.clear();
    };
  }, []);

  const renderDesktopNav = (expanded: boolean) => (
    <nav aria-label="관리자 영역 탐색" className="grid gap-6">
      {navGroups.map((group) => (
        <section key={group.label} className="grid gap-2" aria-label={group.label}>
          {expanded ? (
            <div className="px-3">
              <p className="pv2-caption text-pv2-nav-text">
                {group.label}
              </p>
              <p className="mt-1 pv2-caption text-pv2-nav-text">
                {group.description}
              </p>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            {group.items.map((item) => {
              const active = isAdminNavActive(pathname, item.href);
              const Icon = ADMIN_NAV_ICON_BY_KEY[item.iconKey];

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onPointerEnter={() => prefetchOnIntent(item.href, "hover")}
                  onPointerLeave={() => cancelHoverPrefetch(item.href)}
                  onFocus={() => prefetchOnIntent(item.href, "focus")}
                  title={expanded ? undefined : item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 items-center gap-3 rounded-pv2-control px-3 py-2 text-sm transition-colors",
                    PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
                    active
                      ? "bg-pv2-nav-active text-pv2-on-dark"
                      : "text-pv2-nav-text hover:bg-pv2-nav-active/60 hover:text-pv2-on-dark",
                    expanded ? "justify-start" : "justify-center px-2.5",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {expanded ? (
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate pv2-label">{item.label}</span>
                      <span className="truncate pv2-caption opacity-80">{item.description}</span>
                    </span>
                  ) : (
                    <span className="sr-only">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  return (
    <AdminQuickNavigatorProvider navGroups={navGroups}>
      <div
        className="portal-v2 min-h-dvh"
        data-admin-hydrated={hydrated}
      >
      <a
        href="#admin-main-content"
        className={cn(skipLinkClassName, "md:hidden")}
      >
        주요 내용으로 건너뛰기
      </a>
      <a
        href="#admin-main-content"
        className={cn(skipLinkClassName, "hidden md:inline-flex")}
      >
        주요 내용으로 건너뛰기
      </a>
      <div className="md:hidden">
        <div
          aria-hidden="true"
          className="min-safe-admin-header"
          style={headerHeight ? { height: headerHeight } : undefined}
        />
        <header className="fixed inset-x-0 top-0 z-40">
          <div
            ref={headerRef}
            className="border-b border-border/70 bg-surface-overlay/95 pt-safe-top shadow-flat backdrop-blur-xl"
          >
            <Container className="flex items-center justify-between gap-3 py-3" size="dashboard">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {SITE_NAME}
                </p>
                <p className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
                  {activeNavItem?.label ?? title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AdminQuickNavigatorTrigger compact />
              </div>
            </Container>
          </div>
        </header>

      </div>

      <nav
        aria-label="관리자 주요 탐색"
        data-admin-mobile-navigation
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface-overlay/95 pb-safe-bottom shadow-floating backdrop-blur-xl md:hidden"
      >
          <Container size="dashboard" className="flex items-stretch">
            {mobileNavEntries.map((entry) => {
              if (entry.kind === "search") {
                return (
                  <AdminQuickNavigatorTrigger
                    key={entry.id}
                    compact
                    compactLabel={entry.label}
                    className={cn(
                      mobileNavItemClassName(false),
                      "h-auto w-auto rounded-none border-0 bg-transparent shadow-none",
                    )}
                  />
                );
              }

              if (entry.kind === "more") {
                return (
                  <AdminMobileNav
                    key={entry.id}
                    title={title}
                    backHref={backHref}
                    backLabel={backLabel}
                    logoutAction={logoutAction}
                    navGroups={navGroups}
                    triggerClassName={cn(
                      mobileNavItemClassName(false),
                      "h-auto w-auto rounded-none border-0 bg-transparent shadow-none",
                    )}
                    triggerContent={
                      <>
                        <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                        <span>{entry.label}</span>
                      </>
                    }
                  />
                );
              }

              const Icon = ADMIN_NAV_ICON_BY_KEY[entry.iconKey];
              const active = isAdminNavActive(pathname, entry.href);
              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  prefetch={false}
                  onPointerEnter={() => prefetchOnIntent(entry.href, "hover")}
                  onPointerLeave={() => cancelHoverPrefetch(entry.href)}
                  onFocus={() => prefetchOnIntent(entry.href, "focus")}
                  title={entry.fullLabel !== entry.label ? entry.fullLabel : undefined}
                  aria-current={active ? "page" : undefined}
                  className={mobileNavItemClassName(active)}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{entry.label}</span>
                </Link>
              );
            })}
          </Container>
      </nav>

      <div
        className={cn(
          "md:grid md:min-h-dvh xl:grid-cols-[18rem_minmax(0,1fr)]",
          isTabletNavExpanded
            ? "md:grid-cols-[18rem_minmax(0,1fr)]"
            : "md:grid-cols-[5.5rem_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden bg-pv2-sidebar md:sticky md:top-0 md:block md:h-dvh">
          <div
            className={cn(
              "flex h-full flex-col gap-4 py-4 xl:gap-6 xl:px-4 xl:py-5",
              isTabletNavExpanded ? "px-4" : "px-3",
            )}
          >
            <Link
              href="/admin"
              prefetch={false}
              onPointerEnter={() => prefetchOnIntent("/admin", "hover")}
              onPointerLeave={() => cancelHoverPrefetch("/admin")}
              onFocus={() => prefetchOnIntent("/admin", "focus")}
              aria-label="관리 홈"
              className={cn(
                "flex min-h-12 items-center rounded-pv2-control bg-pv2-nav-active px-3 py-2 text-pv2-on-dark",
                PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
                isTabletNavExpanded
                  ? "justify-start gap-3"
                  : "justify-center xl:justify-start xl:gap-3",
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-pv2-control bg-pv2-sidebar">
                <HomeIcon className="h-5 w-5" />
              </span>
              <span
                className={cn(
                  "min-w-0",
                  isTabletNavExpanded ? "grid" : "hidden xl:grid",
                )}
              >
                <span className="truncate pv2-label">{SITE_NAME}</span>
                <span className="truncate pv2-caption text-pv2-nav-text">관리자</span>
              </span>
            </Link>

            <button
              type="button"
              className={cn(
                "hidden min-h-11 items-center rounded-pv2-control px-3 text-sm font-semibold text-pv2-nav-text transition-colors hover:bg-pv2-nav-active/60 hover:text-pv2-on-dark xl:hidden md:flex",
                PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
                isTabletNavExpanded ? "justify-between" : "justify-center",
              )}
              aria-label={isTabletNavExpanded ? "관리 메뉴 접기" : "관리 메뉴 펼치기"}
              aria-expanded={isTabletNavExpanded}
              onClick={() => setIsTabletNavExpanded((expanded) => !expanded)}
            >
              {isTabletNavExpanded ? (
                <>
                  <span>메뉴 접기</span>
                  <ChevronDoubleLeftIcon className="h-4 w-4" aria-hidden="true" />
                </>
              ) : (
                <ChevronDoubleRightIcon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="xl:hidden">{renderDesktopNav(isTabletNavExpanded)}</div>
              <div className="hidden xl:block">{renderDesktopNav(true)}</div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 hidden border-b border-pv2-border bg-pv2-surface md:block">
            <Container className="flex min-h-[4.75rem] items-center justify-between gap-4 py-4" size="dashboard">
              <div className="min-w-0">
                {activeNavItem?.href !== "/admin" ? (
                  <div className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Link
                      href="/admin"
                      prefetch={false}
                      onPointerEnter={() => prefetchOnIntent("/admin", "hover")}
                      onPointerLeave={() => cancelHoverPrefetch("/admin")}
                      onFocus={() => prefetchOnIntent("/admin", "focus")}
                      className="hover:text-foreground"
                    >
                      관리 홈
                    </Link>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                    <span className="truncate">{activeNavItem?.label ?? title}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="xl:hidden">
                  <AdminQuickNavigatorTrigger compact />
                </span>
                <span className="hidden xl:inline-flex">
                  <AdminQuickNavigatorTrigger />
                </span>
                {backHref && backLabel ? (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      href={backHref}
                      ariaLabel={backLabel}
                      title={backLabel}
                      className="xl:hidden"
                    >
                      <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      href={backHref}
                      className="hidden xl:inline-flex"
                    >
                      {backLabel}
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="secondary"
                  size="icon"
                  href="/"
                  ariaLabel="사용자 화면 열기"
                  title="사용자 화면"
                  className="xl:hidden"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="secondary" href="/" className="hidden xl:inline-flex">
                  <span className="inline-flex items-center gap-2">
                    사용자 화면
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </span>
                </Button>
                <AdminLogoutButton action={logoutAction} />
              </div>
            </Container>
          </header>

          <main id="admin-main-content" tabIndex={-1}>
            <Container
              className="pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-8 md:pb-16"
              size="dashboard"
            >
              {children}
            </Container>
          </main>
        </div>
      </div>
      </div>
    </AdminQuickNavigatorProvider>
  );
}
