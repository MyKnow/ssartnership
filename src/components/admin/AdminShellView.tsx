"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";
import {
  ADMIN_NAV_GROUPS,
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
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  logoutAction: AdminLogoutAction;
}) {
  const pathname = usePathname();
  const { hidden, headerHeight, headerRef } = useAutoHideHeader();
  const activeNavItem = findAdminNavItem(pathname);

  const renderDesktopNav = (expanded: boolean) => (
    <nav className="grid gap-6">
      {ADMIN_NAV_GROUPS.map((group) => (
        <section key={group.label} className="grid gap-2">
          {expanded ? (
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group.label}
            </p>
          ) : null}
          <div className="grid gap-1.5">
            {group.items.map((item) => {
              const active = isAdminNavActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={expanded ? undefined : item.label}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-surface-elevated hover:text-foreground",
                    expanded ? "justify-start" : "justify-center px-2.5",
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {expanded ? (
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-semibold text-foreground">{item.label}</span>
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
    <div className="min-h-screen bg-background">
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
                  Admin Workspace
                </p>
                <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
                  {title}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  href="/admin"
                  ariaLabel="관리 홈으로 이동"
                  title="관리 홈"
                >
                  <HomeIcon className="h-5 w-5" />
                </Button>
                <ThemeToggle />
                <AdminMobileNav
                  title={title}
                  backHref={backHref}
                  backLabel={backLabel}
                  logoutAction={logoutAction}
                />
              </div>
            </Container>
          </div>
        </header>

        <main>
          <Container className="pb-16 pt-8" size="dashboard">
            {children}
          </Container>
        </main>
      </div>

      <div className="hidden min-h-screen md:grid md:grid-cols-[5.5rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="sticky top-0 h-screen border-r border-border/70 bg-surface/95 backdrop-blur-xl">
          <div className="flex h-full flex-col gap-6 px-3 py-4 xl:px-4 xl:py-5">
            <Link
              href="/admin"
              className={cn(
                "flex items-center rounded-2xl border border-border/70 bg-surface-elevated px-3 py-3 text-foreground shadow-flat",
                "justify-center xl:justify-start xl:gap-3",
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface-muted">
                <HomeIcon className="h-5 w-5" />
              </span>
              <span className="hidden min-w-0 xl:grid">
                <span className="truncate text-sm font-semibold">{SITE_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">Admin</span>
              </span>
            </Link>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="xl:hidden">{renderDesktopNav(false)}</div>
              <div className="hidden xl:block">{renderDesktopNav(true)}</div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
            <Container className="flex min-h-[4.75rem] items-center justify-between gap-4 py-4" size="dashboard">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Link href="/admin" className="hover:text-foreground">
                    관리 홈
                  </Link>
                  {activeNavItem?.href !== "/admin" ? (
                    <>
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                      <span className="truncate">{activeNavItem?.label ?? title}</span>
                    </>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {title}
                </h1>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {backHref && backLabel ? (
                  <Button variant="secondary" href={backHref}>
                    {backLabel}
                  </Button>
                ) : null}
                <Button variant="secondary" href="/">
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

          <main>
            <Container className="pb-16 pt-8" size="dashboard">
              {children}
            </Container>
          </main>
        </div>
      </div>

      <ScrollToTopFab />
    </div>
  );
}
