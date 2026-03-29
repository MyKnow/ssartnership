"use client";

import { HomeIcon } from "@heroicons/react/24/outline";
import ThemeToggle from "@/components/ThemeToggle";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import { SITE_NAME } from "@/lib/site";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { logout } from "@/app/admin/(protected)/actions";
import { cn } from "@/lib/cn";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";

export default function AdminShell({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  const { hidden, headerHeight, headerRef } = useAutoHideHeader();

  return (
    <div className="min-h-screen bg-background">
      <div
        aria-hidden="true"
        className="min-h-[calc(6.5rem+env(safe-area-inset-top))]"
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
          <Container className="flex items-start justify-between gap-4 py-5 sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {SITE_NAME}
              </p>
              <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
                {title}
              </h1>
            </div>
            <div className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
              {backHref && backLabel ? (
                <Button variant="ghost" href={backHref}>
                  {backLabel}
                </Button>
              ) : null}
              <Button variant="ghost" href="/">
                사용자 화면
              </Button>
              <ThemeToggle />
              <AdminLogoutButton action={logout} />
            </div>
            <div className="flex items-center gap-2 sm:hidden">
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
                logoutAction={logout}
              />
            </div>
          </Container>
        </div>
      </header>

      <main>
        <Container className="pb-16 pt-10">{children}</Container>
      </main>
      <ScrollToTopFab />
    </div>
  );
}
