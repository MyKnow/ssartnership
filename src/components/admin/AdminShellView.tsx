"use client";

import dynamic from "next/dynamic";
import { HomeIcon } from "@heroicons/react/24/outline";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";

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
  const { hidden, headerHeight, headerRef } = useAutoHideHeader();

  return (
    <div className="min-h-screen bg-background">
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
          <Container className="flex items-start justify-between gap-4 py-5 sm:items-center" size="wide">
            <div className="min-w-0">
              <p className="ui-kicker">{SITE_NAME}</p>
              <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
                {title}
              </h1>
            </div>
            <div className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
              {backHref && backLabel ? (
                <Button variant="secondary" href={backHref}>
                  {backLabel}
                </Button>
              ) : null}
              <Button variant="secondary" href="/">
                사용자 화면
              </Button>
              <ThemeToggle />
              <AdminLogoutButton action={logoutAction} />
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
                logoutAction={logoutAction}
              />
            </div>
          </Container>
        </div>
      </header>

      <main>
        <Container className="pb-16 pt-10" size="wide">{children}</Container>
      </main>
      <ScrollToTopFab />
    </div>
  );
}
