"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ExternalLink,
  Gauge,
  Home,
  KeyRound,
  LifeBuoy,
  LogOut,
  Settings,
} from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";
import ThemeToggle from "@/components/ThemeToggle";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import type { PartnerSession } from "@/lib/partner-session";
import { TECH_SUPPORT_HREF } from "@/lib/support-mail";

type PartnerPortalShellViewProps = {
  children: React.ReactNode;
  session: PartnerSession | null;
  isMock: boolean;
};

const primaryNavItems = [
  {
    href: "/partner",
    label: "대시보드",
    description: "브랜드 현황",
    icon: Gauge,
  },
  {
    href: "/partner/notifications",
    label: "알림센터",
    description: "운영 알림",
    icon: Bell,
  },
  {
    href: "/partner/change-password",
    label: "비밀번호 변경",
    description: "계정 보안",
    icon: KeyRound,
  },
  {
    href: "/partner/support",
    label: "기술 지원",
    description: "문의 템플릿",
    icon: LifeBuoy,
  },
] as const;

const setupNavItem = {
  href: "/partner/setup",
  label: "초기 설정",
  description: "데모 계정 연결",
  icon: Settings,
} as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/partner") {
    return pathname === href || pathname.startsWith("/partner/services/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getCurrentNavLabel(pathname: string, isMock: boolean) {
  const navItems = isMock ? [...primaryNavItems, setupNavItem] : primaryNavItems;
  return navItems.find((item) => isActivePath(pathname, item.href))?.label ?? "협력사 포털";
}

function MobileTopBar({
  session,
  isMock,
}: {
  session: PartnerSession | null;
  isMock: boolean;
}) {
  return (
    <header className="border-b border-border/70 bg-surface-overlay/95 shadow-flat backdrop-blur-xl md:hidden">
      <Container size="wide" className="flex flex-wrap items-center justify-between gap-3 py-4">
        <Link
          href="/partner"
          aria-label="협력사 포털 홈"
          className="inline-flex items-center text-foreground hover:opacity-80"
        >
          <BrandWordmark className="text-lg" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Link
              href="/partner/logout"
              prefetch={false}
              aria-label="로그아웃"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-danger/20 bg-danger/10 text-danger shadow-flat transition-interactive hover:-translate-y-px hover:bg-danger/12"
            >
              <LogOut className="h-5 w-5" />
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-[1rem] border border-border bg-surface-control px-4 text-sm font-semibold text-foreground shadow-flat"
            >
              공개 홈
            </Link>
          )}
        </div>
        {session ? (
          <nav className="flex w-full gap-2 overflow-x-auto pb-1">
            {[...primaryNavItems, ...(isMock ? [setupNavItem] : [])].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex shrink-0 items-center gap-2 rounded-[0.95rem] border border-border bg-surface-control px-3 py-2 text-xs font-semibold text-foreground shadow-flat"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </Container>
    </header>
  );
}

function SimpleFooter() {
  return (
    <footer className="border-t border-border/70 bg-surface-overlay/92 py-6 backdrop-blur-xl">
      <Container size="wide" className="flex flex-col gap-2 text-xs leading-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>협력사 담당자 전용 공간입니다. 정보 변경은 승인 절차를 거칩니다.</p>
        <a href={TECH_SUPPORT_HREF} className="font-medium text-foreground hover:opacity-80">
          기술 지원
        </a>
      </Container>
    </footer>
  );
}

function DashboardSidebar({
  pathname,
  isMock,
}: {
  pathname: string;
  isMock: boolean;
}) {
  const navItems = isMock ? [...primaryNavItems, setupNavItem] : primaryNavItems;

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-border/70 bg-surface-overlay/95 backdrop-blur-xl md:block">
      <div className="flex h-full flex-col gap-6 px-3 py-4 xl:px-4">
        <Link
          href="/partner"
          aria-label="협력사 포털 홈"
          className="flex h-14 items-center gap-3 rounded-[1.1rem] border border-border bg-surface-control px-3 shadow-flat"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-border bg-background text-primary">
            <Home className="h-4 w-4" />
          </span>
          <span className="hidden min-w-0 xl:block">
            <BrandWordmark className="text-lg" />
            <span className="block truncate text-xs font-medium text-muted-foreground">
              Partner Portal
            </span>
          </span>
        </Link>

        <nav className="space-y-1">
          <p className="hidden px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground xl:block">
            운영 메뉴
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-3 rounded-[1rem] border px-3 text-sm font-semibold transition-surface xl:justify-start",
                  active
                    ? "border-primary/20 bg-primary-soft text-primary shadow-flat"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-control hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden min-w-0 xl:block">
                  <span className="block truncate">{item.label}</span>
                  <span
                    className={cn(
                      "block truncate text-xs font-medium",
                      active ? "text-primary/75" : "text-muted-foreground",
                    )}
                  >
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center gap-3 rounded-[1rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat transition-interactive hover:-translate-y-px xl:justify-start"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden xl:inline">사용자 화면</span>
          </Link>
          <Link
            href="/partner/logout"
            prefetch={false}
            className="flex min-h-11 items-center justify-center gap-3 rounded-[1rem] border border-danger/20 bg-danger/10 px-3 text-sm font-semibold text-danger shadow-flat transition-interactive hover:-translate-y-px xl:justify-start"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden xl:inline">로그아웃</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

function DashboardTopBar({
  pathname,
  session,
  isMock,
}: {
  pathname: string;
  session: PartnerSession;
  isMock: boolean;
}) {
  const currentLabel = getCurrentNavLabel(pathname, isMock);

  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/70 bg-background/88 backdrop-blur-xl md:block">
      <Container size="wide" className="flex min-h-16 items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="ui-kicker">협력사 포털 · {currentLabel}</p>
          <h1 className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground">
            {session.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-[0.95rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat transition-interactive hover:-translate-y-px"
          >
            사용자 화면
            <ExternalLink className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}

export default function PartnerPortalShellView({
  children,
  session,
  isMock,
}: PartnerPortalShellViewProps) {
  const pathname = usePathname();
  const isSetupRoute = pathname.startsWith("/partner/setup");
  const isAuthRoute =
    pathname === "/partner/login" ||
    pathname === "/partner/reset" ||
    pathname.startsWith("/partner/setup");
  const useDashboardShell = Boolean(session) && !isAuthRoute && !isSetupRoute;

  if (!useDashboardShell || !session) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <MobileTopBar session={session} isMock={isMock} />
        <div className="hidden border-b border-border/70 bg-surface-overlay/95 shadow-flat backdrop-blur-xl md:block">
          <Container size="wide" className="flex min-h-16 items-center justify-between gap-4 py-3">
            <Link
              href="/partner"
              aria-label="협력사 포털 홈"
              className="inline-flex items-center gap-3 text-foreground hover:opacity-80"
            >
              <BrandWordmark className="text-xl" />
              <span className="rounded-full border border-border bg-surface-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                협력사 포털
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-[0.95rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat"
              >
                공개 홈
              </Link>
            </div>
          </Container>
        </div>
        <main className="flex-1">{children}</main>
        <SimpleFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[5.5rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
      <MobileTopBar session={session} isMock={isMock} />
      <DashboardSidebar pathname={pathname} isMock={isMock} />
      <div className="min-w-0">
        <DashboardTopBar pathname={pathname} session={session} isMock={isMock} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
