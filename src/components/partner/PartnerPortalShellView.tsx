"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  Building2,
  CreditCard,
  ExternalLink,
  Home,
  IdCard,
  LifeBuoy,
  LogOut,
  MoreHorizontal,
  Settings,
  Store,
} from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import ThemeToggle from "@/components/ThemeToggle";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import {
  getCompanyScopedPortalHref,
  getPartnerGlobalPortalHref,
  getPartnerCompanyIdFromSearchParams,
  getPartnerCompanyIdFromPathname,
  getPartnerPortalMobileNavigation,
  PARTNER_PASSWORD_CHANGE_PATH,
} from "@/lib/partner-portal-paths";
import {
  shouldShowPartnerPortalMobileNavigation,
  shouldUsePartnerPortalDashboardShell,
} from "@/lib/partner-portal-layout";
import type { PartnerPortalCompanyScope } from "@/lib/partner-portal-scope";
import type { PartnerSession } from "@/lib/partner-session";
import { TECH_SUPPORT_HREF } from "@/lib/support-mail";

type PartnerPortalShellViewProps = {
  children: React.ReactNode;
  session: PartnerSession | null;
  companies: PartnerPortalCompanyScope[];
  isMock: boolean;
};

const companyNavItems = [
  {
    section: "dashboard",
    label: "홈",
    description: "운영 요약",
    icon: Home,
  },
  {
    section: "services",
    label: "제휴처",
    description: "목록과 상세",
    icon: Store,
  },
  {
    section: "plans",
    label: "플랜",
    description: "요금제와 요청",
    icon: CreditCard,
  },
] as const;

const globalNavItems = [
  {
    section: "notifications",
    label: "알림",
    description: "운영 알림",
    icon: Bell,
  },
  {
    section: "account",
    label: "계정",
    description: "계정과 증빙",
    icon: IdCard,
  },
  {
    section: "support",
    label: "기술 지원",
    description: "문의 템플릿",
    icon: LifeBuoy,
  },
] as const;

const primaryNavItems = [...companyNavItems, ...globalNavItems] as const;

const setupNavItem = {
  href: "/partner/setup",
  label: "초기 설정",
  description: "데모 계정 연결",
  icon: Settings,
} as const;

type PrimaryNavItem = (typeof primaryNavItems)[number];
type PortalNavItem = PrimaryNavItem | typeof setupNavItem;
type PrimaryNavSection = PrimaryNavItem["section"];

function isGlobalSection(
  section: PrimaryNavSection,
): section is "notifications" | "account" | "support" {
  return (
    section === "notifications" ||
    section === "account" ||
    section === "support"
  );
}

function getPrimaryNavHref(item: PrimaryNavItem, companyId: string | null) {
  if (!companyId) {
    return isGlobalSection(item.section)
      ? getPartnerGlobalPortalHref(item.section)
      : "/partner";
  }
  if (isGlobalSection(item.section)) {
    return getPartnerGlobalPortalHref(item.section, companyId);
  }
  return getCompanyScopedPortalHref(companyId, item.section);
}

function getPortalNavHref(item: PortalNavItem, companyId: string | null) {
  if ("section" in item) {
    return getPrimaryNavHref(item, companyId);
  }
  return item.href;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActivePrimaryPath(
  pathname: string,
  item: PrimaryNavItem,
  companyId: string | null,
) {
  if (!companyId) {
    if (isGlobalSection(item.section)) {
      return pathname === `/partner/${item.section}`;
    }
    return pathname === "/partner" && item.section === "dashboard";
  }
  if (isGlobalSection(item.section)) {
    return pathname === `/partner/${item.section}`;
  }
  const scopedHref = getCompanyScopedPortalHref(companyId);
  if (item.section === "dashboard") {
    return pathname === scopedHref;
  }
  if (item.section === "services") {
    return pathname.startsWith(`${scopedHref}/services/`);
  }
  return pathname === `${scopedHref}/plans`;
}

function isActivePortalNavPath(
  pathname: string,
  item: PortalNavItem,
  companyId: string | null,
) {
  if ("section" in item) {
    return isActivePrimaryPath(pathname, item, companyId);
  }
  return isActivePath(pathname, item.href);
}

function getCurrentNavLabel(
  pathname: string,
  isMock: boolean,
  companyId: string | null,
) {
  if (pathname.startsWith(PARTNER_PASSWORD_CHANGE_PATH)) {
    return "계정";
  }
  const navItems = isMock
    ? [...primaryNavItems, setupNavItem]
    : primaryNavItems;
  return (
    navItems.find((item) => isActivePortalNavPath(pathname, item, companyId))
      ?.label ?? "파트너 포털"
  );
}

function MobileTopBar({
  pathname,
  session,
  isMock,
  currentCompanyId,
  currentCompany,
  showNavigation,
}: {
  pathname: string;
  session: PartnerSession | null;
  isMock: boolean;
  currentCompanyId: string | null;
  currentCompany: PartnerPortalCompanyScope | null;
  showNavigation: boolean;
}) {
  const mobileItems = getPartnerPortalMobileNavigation(currentCompanyId);
  const moreActive =
    pathname === "/partner/account" ||
    pathname === "/partner/support" ||
    pathname.endsWith("/plans");

  return (
    <header className="relative z-40 border-b border-border/70 bg-surface-overlay/95 shadow-flat backdrop-blur-xl md:hidden">
      <Container
        size="wide"
        className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
      >
        <div className="min-w-0">
          <PartnerPendingLink
            href={currentCompanyId ? getCompanyScopedPortalHref(currentCompanyId) : "/partner"}
            aria-label="파트너 포털 홈"
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-lg" />
          </PartnerPendingLink>
          {currentCompany ? (
            <p className="mt-0.5 max-w-40 truncate text-xs font-semibold text-muted-foreground min-[390px]:max-w-52">
              {currentCompany.name}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <PartnerPendingLink
              href="/partner/logout"
              prefetch={false}
              aria-label="로그아웃"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-danger/20 bg-danger/10 text-danger shadow-flat transition-interactive hover:-translate-y-px hover:bg-danger/12"
            >
              <LogOut className="h-5 w-5" />
            </PartnerPendingLink>
          ) : (
            <PartnerPendingLink
              href="/"
              className="inline-flex h-11 items-center rounded-[1rem] border border-border bg-surface-control px-4 text-sm font-semibold text-foreground shadow-flat"
            >
              공개 홈
            </PartnerPendingLink>
          )}
        </div>
        {session && showNavigation ? (
          <div className="w-full min-w-0">
            <nav
              aria-label="파트너 포털 주요 메뉴"
              className="grid w-full min-w-0 grid-cols-4 gap-1.5"
            >
              {mobileItems.slice(0, 3).map((item) => {
                const Icon =
                  item.id === "home"
                    ? Home
                    : item.id === "services"
                      ? Store
                      : Bell;
                const active =
                  item.id === "home"
                    ? pathname === getCompanyScopedPortalHref(currentCompanyId ?? "")
                    : item.id === "services"
                      ? Boolean(
                          currentCompanyId &&
                            pathname.startsWith(
                              `${getCompanyScopedPortalHref(currentCompanyId)}/services`,
                            ),
                        )
                      : pathname === "/partner/notifications";
                return (
                  <PartnerPendingLink
                    key={item.id}
                    href={item.href ?? "/partner"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.9rem] border px-1.5 py-1.5 text-[11px] font-semibold shadow-flat transition-surface",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface-control text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </PartnerPendingLink>
                );
              })}
              <details className="group relative min-w-0">
                <summary
                  aria-current={moreActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-0 cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-[0.9rem] border px-1.5 py-1.5 text-[11px] font-semibold shadow-flat transition-surface marker:content-none",
                    moreActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface-control text-foreground",
                  )}
                >
                  <MoreHorizontal className="h-4 w-4 shrink-0" />
                  <span className="truncate">더보기</span>
                </summary>
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(16rem,calc(100vw-2rem))] gap-1 rounded-[1rem] border border-border bg-surface-overlay p-2 shadow-overlay">
                  {[
                    ...(currentCompanyId
                      ? [
                          {
                            href: getCompanyScopedPortalHref(currentCompanyId, "plans"),
                            label: "플랜 관리",
                            icon: CreditCard,
                          },
                        ]
                      : []),
                    {
                      href: getPartnerGlobalPortalHref("account", currentCompanyId),
                      label: "계정",
                      icon: IdCard,
                    },
                    {
                      href: getPartnerGlobalPortalHref("support", currentCompanyId),
                      label: "기술 지원",
                      icon: LifeBuoy,
                    },
                    ...(isMock
                      ? [{ href: setupNavItem.href, label: setupNavItem.label, icon: Settings }]
                      : []),
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <PartnerPendingLink
                        key={item.href}
                        href={item.href}
                        className="flex min-h-11 min-w-0 items-center gap-3 rounded-[0.85rem] px-3 text-sm font-semibold text-foreground hover:bg-surface-control"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{item.label}</span>
                      </PartnerPendingLink>
                    );
                  })}
                </div>
              </details>
            </nav>
          </div>
        ) : null}
      </Container>
    </header>
  );
}

function SimpleFooter() {
  return (
    <footer className="border-t border-border/70 bg-surface-overlay/92 py-6 backdrop-blur-xl">
      <Container
        size="wide"
        className="flex flex-col gap-2 text-xs leading-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <p>파트너사 담당자 전용 공간입니다. 정보 변경은 승인 절차를 거칩니다.</p>
        <a
          href={TECH_SUPPORT_HREF}
          className="font-medium text-foreground hover:opacity-80"
        >
          기술 지원
        </a>
      </Container>
    </footer>
  );
}

function DashboardSidebar({
  pathname,
  isMock,
  currentCompanyId,
  currentCompany,
}: {
  pathname: string;
  isMock: boolean;
  currentCompanyId: string | null;
  currentCompany: PartnerPortalCompanyScope | null;
}) {
  const navItems = isMock
    ? [...primaryNavItems, setupNavItem]
    : primaryNavItems;

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-border/70 bg-surface-overlay/95 backdrop-blur-xl md:block">
      <div className="flex h-full flex-col gap-6 px-3 py-4 xl:px-4">
        <PartnerPendingLink
          href="/partner"
          aria-label="파트너 포털 홈"
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
        </PartnerPendingLink>

        <nav className="space-y-1">
          <p className="hidden px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground xl:block">
            운영 메뉴
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const href = getPortalNavHref(item, currentCompanyId);
            const active = isActivePortalNavPath(
              pathname,
              item,
              currentCompanyId,
            );
            return (
              <PartnerPendingLink
                key={"section" in item ? item.section : item.href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-3 rounded-[1rem] border px-3 text-sm font-semibold transition-surface xl:justify-start",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-raised"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-control hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden min-w-0 xl:block">
                  <span className="block truncate">{item.label}</span>
                  <span
                    className={cn(
                      "block truncate text-xs font-medium",
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.description}
                  </span>
                </span>
              </PartnerPendingLink>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          {currentCompany ? (
            <PartnerPendingLink
              href="/partner"
              className="flex min-h-11 items-center justify-center gap-3 rounded-[1rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat transition-interactive hover:-translate-y-px xl:justify-start"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden min-w-0 truncate xl:inline">
                파트너사 선택
              </span>
            </PartnerPendingLink>
          ) : null}
          <PartnerPendingLink
            href="/"
            className="flex min-h-11 items-center justify-center gap-3 rounded-[1rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat transition-interactive hover:-translate-y-px xl:justify-start"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden xl:inline">사용자 화면</span>
          </PartnerPendingLink>
          <PartnerPendingLink
            href="/partner/logout"
            prefetch={false}
            className="flex min-h-11 items-center justify-center gap-3 rounded-[1rem] border border-danger/20 bg-danger/10 px-3 text-sm font-semibold text-danger shadow-flat transition-interactive hover:-translate-y-px xl:justify-start"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden xl:inline">로그아웃</span>
          </PartnerPendingLink>
        </div>
      </div>
    </aside>
  );
}

function DashboardTopBar({
  pathname,
  session,
  isMock,
  currentCompanyId,
  currentCompany,
}: {
  pathname: string;
  session: PartnerSession;
  isMock: boolean;
  currentCompanyId: string | null;
  currentCompany: PartnerPortalCompanyScope | null;
}) {
  const currentLabel = getCurrentNavLabel(pathname, isMock, currentCompanyId);

  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/70 bg-background/88 backdrop-blur-xl md:block">
      <Container
        size="wide"
        className="flex min-h-16 items-center justify-between gap-4 py-3"
      >
        <div className="min-w-0">
          <p className="ui-kicker">파트너 포털 · {currentLabel}</p>
          <p className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground">
            {currentCompany?.name ?? session.displayName}
          </p>
          {currentCompany ? (
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
              담당자 · {session.displayName}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <PartnerPendingLink
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-[0.95rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat transition-interactive hover:-translate-y-px"
          >
            사용자 화면
            <ExternalLink className="h-4 w-4" />
          </PartnerPendingLink>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}

export default function PartnerPortalShellView({
  children,
  session,
  companies,
  isMock,
}: PartnerPortalShellViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const candidateCompanyId =
    getPartnerCompanyIdFromPathname(pathname) ??
    getPartnerCompanyIdFromSearchParams(searchParams);
  const currentCompany =
    companies.find((company) => company.id === candidateCompanyId) ?? null;
  const currentCompanyId = currentCompany?.id ?? null;
  const showMobileNavigation = shouldShowPartnerPortalMobileNavigation({
    pathname,
    hasSession: Boolean(session),
  });
  const useDashboardShell = shouldUsePartnerPortalDashboardShell({
    pathname,
    hasSession: Boolean(session),
  });

  if (!useDashboardShell || !session) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <MobileTopBar
          pathname={pathname}
          session={session}
          isMock={isMock}
          currentCompanyId={currentCompanyId}
          currentCompany={currentCompany}
          showNavigation={showMobileNavigation}
        />
        <div className="hidden border-b border-border/70 bg-surface-overlay/95 shadow-flat backdrop-blur-xl md:block">
          <Container
            size="wide"
            className="flex min-h-16 items-center justify-between gap-4 py-3"
          >
            <PartnerPendingLink
              href="/partner"
              aria-label="파트너 포털 홈"
              className="inline-flex items-center gap-3 text-foreground hover:opacity-80"
            >
              <BrandWordmark className="text-xl" />
              <span className="rounded-full border border-border bg-surface-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                파트너 포털
              </span>
            </PartnerPendingLink>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <PartnerPendingLink
                href="/"
                className="inline-flex h-10 items-center rounded-[0.95rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat"
              >
                공개 홈
              </PartnerPendingLink>
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
      <MobileTopBar
        pathname={pathname}
        session={session}
        isMock={isMock}
        currentCompanyId={currentCompanyId}
        currentCompany={currentCompany}
        showNavigation={showMobileNavigation}
      />
      <DashboardSidebar
        pathname={pathname}
        isMock={isMock}
        currentCompanyId={currentCompanyId}
        currentCompany={currentCompany}
      />
      <div className="min-w-0">
        <DashboardTopBar
          pathname={pathname}
          session={session}
          isMock={isMock}
          currentCompanyId={currentCompanyId}
          currentCompany={currentCompany}
        />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
