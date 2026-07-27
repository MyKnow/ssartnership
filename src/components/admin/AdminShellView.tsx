"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  HomeIcon,
  QueueListIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import FloatingActionGroup from "@/components/FloatingActionGroup";
import AdminQuickNavigatorProvider, {
  AdminQuickNavigatorTrigger,
} from "@/components/admin/AdminQuickNavigator";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";
import {
  ADMIN_NAV_ICON_BY_KEY,
  type AdminNavGroup,
  findAdminNavItem,
  isAdminNavActive,
} from "@/components/admin/admin-navigation";

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
  const prefetchedHrefsRef = useRef(new Set<string>());
  const [isTabletNavExpanded, setIsTabletNavExpanded] = useState(false);
  const { hidden, headerHeight, headerRef } = useAutoHideHeader();
  const activeNavItem =
    navGroups
      .flatMap((group) => group.items)
      .find((item) => isAdminNavActive(pathname, item.href)) ??
    findAdminNavItem(pathname);
  const taskNavItem = navGroups
    .flatMap((group) => group.items)
    .find((item) => item.href === "/admin/tasks");
  const dataGroup = navGroups.find(
    (group) => group.label === "데이터",
  );
  const memberNavItem = dataGroup?.items.find(
    (item) => item.href === "/admin/members",
  );
  const isMemberDataActive = Boolean(
    memberNavItem && isAdminNavActive(pathname, memberNavItem.href),
  );
  const mobileNavItemClassName = (active: boolean) =>
    cn(
      "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );
  const skipLinkClassName =
    "sr-only fixed left-4 top-4 z-[90] rounded-control border border-border bg-surface-overlay px-4 py-3 text-sm font-semibold text-foreground shadow-overlay focus:not-sr-only focus:!fixed focus:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const prefetchOnIntent = useCallback(
    (href: string) => {
      if (prefetchedHrefsRef.current.has(href)) {
        return;
      }
      prefetchedHrefsRef.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  const renderDesktopNav = (expanded: boolean) => (
    <nav aria-label="관리자 영역 탐색" className="grid gap-6">
      {navGroups.map((group) => (
        <section key={group.label} className="grid gap-2" aria-label={group.label}>
          {expanded ? (
            <div className="px-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
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
                  onPointerEnter={() => prefetchOnIntent(item.href)}
                  onFocus={() => prefetchOnIntent(item.href)}
                  title={expanded ? undefined : item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-strong bg-surface-elevated text-foreground shadow-flat"
                      : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-surface-elevated hover:text-foreground",
                    expanded ? "justify-start" : "justify-center px-2.5",
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {expanded ? (
                    <span className="grid min-w-0 gap-0.5">
                      <span className={cn("truncate font-semibold", active ? "text-foreground" : "text-foreground")}>{item.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{item.description}</span>
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
      <div className="min-h-screen bg-background">
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
            className={cn(
              "border-b border-border/70 bg-surface-overlay/95 pt-safe-top shadow-flat backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform",
              hidden ? "-translate-y-full" : "translate-y-0",
            )}
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
                <ThemeToggle />
              </div>
            </Container>
          </div>
        </header>

      </div>

      <nav
        aria-label="관리자 주요 탐색"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface-overlay/95 pb-safe-bottom shadow-floating backdrop-blur-xl md:hidden"
      >
          <Container size="dashboard" className="flex items-stretch">
            <Link
              href="/admin"
              prefetch={false}
              onPointerEnter={() => prefetchOnIntent("/admin")}
              onFocus={() => prefetchOnIntent("/admin")}
              aria-current={pathname === "/admin" ? "page" : undefined}
              className={mobileNavItemClassName(pathname === "/admin")}
            >
              <HomeIcon className="h-5 w-5" aria-hidden="true" />
              <span>홈</span>
            </Link>
            {taskNavItem ? (
              <Link
                href={taskNavItem.href}
                prefetch={false}
                onPointerEnter={() => prefetchOnIntent(taskNavItem.href)}
                onFocus={() => prefetchOnIntent(taskNavItem.href)}
                aria-current={isAdminNavActive(pathname, taskNavItem.href) ? "page" : undefined}
                className={mobileNavItemClassName(
                  isAdminNavActive(pathname, taskNavItem.href),
                )}
              >
                <QueueListIcon className="h-5 w-5" aria-hidden="true" />
                <span>작업함</span>
              </Link>
            ) : null}
            <AdminQuickNavigatorTrigger
              compact
              compactLabel="검색"
              className={cn(
                mobileNavItemClassName(false),
                "h-auto w-auto rounded-none border-0 bg-transparent shadow-none",
              )}
            />
            {memberNavItem ? (
              <Link
                href={memberNavItem.href}
                prefetch={false}
                onPointerEnter={() => prefetchOnIntent(memberNavItem.href)}
                onFocus={() => prefetchOnIntent(memberNavItem.href)}
                title={memberNavItem.label}
                aria-current={isMemberDataActive ? "page" : undefined}
                className={mobileNavItemClassName(isMemberDataActive)}
              >
                <Squares2X2Icon className="h-5 w-5" aria-hidden="true" />
                <span>회원</span>
              </Link>
            ) : null}
            <AdminMobileNav
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
                  <span>더보기</span>
                </>
              }
            />
          </Container>
      </nav>

      <div
        className={cn(
          "md:grid md:min-h-screen xl:grid-cols-[18rem_minmax(0,1fr)]",
          isTabletNavExpanded
            ? "md:grid-cols-[18rem_minmax(0,1fr)]"
            : "md:grid-cols-[5.5rem_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden border-r border-border/70 bg-surface/95 backdrop-blur-xl md:sticky md:top-0 md:block md:h-screen">
          <div
            className={cn(
              "flex h-full flex-col gap-4 py-4 xl:gap-6 xl:px-4 xl:py-5",
              isTabletNavExpanded ? "px-4" : "px-3",
            )}
          >
            <Link
              href="/admin"
              prefetch={false}
              onPointerEnter={() => prefetchOnIntent("/admin")}
              onFocus={() => prefetchOnIntent("/admin")}
              aria-label="관리 홈"
              className={cn(
                "flex items-center rounded-2xl border border-border/70 bg-surface-elevated px-3 py-3 text-foreground shadow-flat",
                isTabletNavExpanded
                  ? "justify-start gap-3"
                  : "justify-center xl:justify-start xl:gap-3",
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface-muted">
                <HomeIcon className="h-5 w-5" />
              </span>
              <span
                className={cn(
                  "min-w-0",
                  isTabletNavExpanded ? "grid" : "hidden xl:grid",
                )}
              >
                <span className="truncate text-sm font-semibold">{SITE_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">관리자</span>
              </span>
            </Link>

            <button
              type="button"
              className={cn(
                "hidden min-h-11 items-center rounded-2xl border border-border/70 bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat transition-colors hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 xl:hidden md:flex",
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
          <header className="sticky top-0 z-30 hidden border-b border-border/70 bg-background/90 backdrop-blur-xl md:block">
            <Container className="flex min-h-[4.75rem] items-center justify-between gap-4 py-4" size="dashboard">
              <div className="min-w-0">
                {activeNavItem?.href !== "/admin" ? (
                  <div className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Link
                      href="/admin"
                      prefetch={false}
                      onPointerEnter={() => prefetchOnIntent("/admin")}
                      onFocus={() => prefetchOnIntent("/admin")}
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
                <ThemeToggle />
                <AdminLogoutButton action={logoutAction} />
              </div>
            </Container>
          </header>

          <FloatingActionGroup className="!bottom-[calc(5rem+env(safe-area-inset-bottom))] md:!bottom-safe-bottom-5">
            <ScrollToTopFab />
            <main id="admin-main-content" tabIndex={-1}>
              <Container
                className="pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-8 md:pb-16"
                size="dashboard"
              >
                {children}
              </Container>
            </main>
          </FloatingActionGroup>
        </div>
      </div>
      </div>
    </AdminQuickNavigatorProvider>
  );
}
