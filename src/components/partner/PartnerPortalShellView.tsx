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
  Settings,
  Store,
} from "lucide-react";
import PartnerLogoutButton from "@/components/partner/PartnerLogoutButton";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import PortalShell from "@/components/portal-v2/PortalShell";
import {
  PV2_FOCUS_RING_CLASS_NAME,
  PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
} from "@/components/portal-v2/portal-v2-classes";
import type {
  PortalNavGroup,
  PortalNavIcon,
  PortalNavItem,
} from "@/components/portal-v2/portal-shell-navigation";
import { cn } from "@/lib/cn";
import {
  getCompanyScopedPortalHref,
  getPartnerGlobalPortalHref,
  getPartnerCompanyIdFromSearchParams,
  getPartnerCompanyIdFromPathname,
  PARTNER_PASSWORD_CHANGE_PATH,
} from "@/lib/partner-auth/portal-paths";
import { shouldUsePartnerPortalDashboardShell } from "@/lib/partner-auth/portal-layout";
import type { PartnerPortalCompanyScope } from "@/lib/partner-auth/portal-scope";
import type { PartnerSession } from "@/lib/partner-session";
import { TECH_SUPPORT_HREF } from "@/lib/support-mail";

type PartnerPortalShellViewProps = {
  children: React.ReactNode;
  session: PartnerSession | null;
  companies: PartnerPortalCompanyScope[];
  /** Company summaries failed to load on the server; show a notice. */
  companiesUnavailable?: boolean;
  isMock: boolean;
};

const COMPANIES_UNAVAILABLE_MESSAGE =
  "회사 정보를 잠시 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";

const PORTAL_BRAND = { name: "싸트너십", area: "파트너 포털", href: "/partner" } as const;

function CompaniesUnavailableNotice() {
  return (
    <p
      role="status"
      className="rounded-pv2-control border border-pv2-warning bg-pv2-warning-soft px-4 py-3 pv2-body text-ko-pretty text-pv2-warning"
    >
      {COMPANIES_UNAVAILABLE_MESSAGE}
    </p>
  );
}

const companyNavItems = [
  { section: "dashboard", label: "홈", icon: Home },
  { section: "services", label: "제휴처", icon: Store },
  { section: "plans", label: "플랜", icon: CreditCard },
] as const;

const globalNavItems = [
  { section: "notifications", label: "알림", icon: Bell },
  { section: "account", label: "계정", icon: IdCard },
  { section: "support", label: "기술 지원", icon: LifeBuoy },
] as const;

const primaryNavItems = [...companyNavItems, ...globalNavItems] as const;

const setupNavItem = {
  href: "/partner/setup",
  label: "초기 설정",
  icon: Settings,
} as const;

type PrimaryNavItem = (typeof primaryNavItems)[number];
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

function isSetupActive(pathname: string) {
  return pathname === setupNavItem.href || pathname.startsWith(`${setupNavItem.href}/`);
}

function getCurrentNavLabel(
  pathname: string,
  isMock: boolean,
  companyId: string | null,
) {
  if (pathname.startsWith(PARTNER_PASSWORD_CHANGE_PATH)) {
    return "계정";
  }
  const primary = primaryNavItems.find((item) =>
    isActivePrimaryPath(pathname, item, companyId),
  );
  if (primary) {
    return primary.label;
  }
  return isMock && isSetupActive(pathname) ? setupNavItem.label : "파트너 포털";
}

function toNavItem(
  item: PrimaryNavItem,
  pathname: string,
  companyId: string | null,
): PortalNavItem {
  return {
    id: item.section,
    href: getPrimaryNavHref(item, companyId),
    label: item.label,
    icon: item.icon as PortalNavIcon,
    active: isActivePrimaryPath(pathname, item, companyId),
  };
}

function buildNavGroups({
  pathname,
  isMock,
  companyId,
}: {
  pathname: string;
  isMock: boolean;
  companyId: string | null;
}): PortalNavGroup[] {
  const accountItems = globalNavItems.map((item) =>
    toNavItem(item, pathname, companyId),
  );
  if (isMock) {
    accountItems.push({
      id: "setup",
      href: setupNavItem.href,
      label: setupNavItem.label,
      icon: setupNavItem.icon as PortalNavIcon,
      active: isSetupActive(pathname),
    });
  }
  return [
    {
      id: "operations",
      label: "운영",
      items: companyNavItems.map((item) => toNavItem(item, pathname, companyId)),
    },
    { id: "account", label: "계정", items: accountItems },
  ];
}

const SIDEBAR_LINK_CLASS_NAME = cn(
  "flex min-h-11 min-w-0 items-center gap-3 rounded-pv2-control p-3 pv2-label text-pv2-nav-text hover:bg-pv2-nav-active/60 hover:text-pv2-on-dark",
  PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
);

function CompanyScope({ company }: { company: PartnerPortalCompanyScope | null }) {
  if (!company) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-pv2-control bg-pv2-nav-active p-3">
      <p className="pv2-caption text-pv2-nav-text">운영 중인 파트너사</p>
      <p className="truncate pv2-label text-pv2-on-dark">{company.name}</p>
      <PartnerPendingLink
        href="/partner"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-pv2-control pv2-caption text-pv2-nav-text hover:text-pv2-on-dark",
          PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
        )}
      >
        <Building2 aria-hidden="true" className="size-4 shrink-0" />
        파트너사 선택
      </PartnerPendingLink>
    </div>
  );
}

function SidebarFooter() {
  return (
    <>
      <PartnerPendingLink href="/" className={SIDEBAR_LINK_CLASS_NAME}>
        <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">사용자 화면</span>
      </PartnerPendingLink>
      <PartnerLogoutButton
        formClassName="w-full"
        className="w-full justify-start px-3"
        variant="secondary"
      >
        <LogOut aria-hidden="true" className="size-4" />
        로그아웃
      </PartnerLogoutButton>
    </>
  );
}

function TopBarStart({
  pathname,
  isMock,
  companyId,
  company,
  session,
}: {
  pathname: string;
  isMock: boolean;
  companyId: string | null;
  company: PartnerPortalCompanyScope | null;
  session: PartnerSession;
}) {
  const label = getCurrentNavLabel(pathname, isMock, companyId);
  return (
    <div className="min-w-0">
      <p className="truncate pv2-caption text-pv2-muted">파트너 포털 · {label}</p>
      <p className="truncate pv2-label text-pv2-text">
        {company?.name ?? session.displayName}
        {company ? (
          <span className="hidden font-normal text-pv2-muted md:inline">
            {" "}
            · 담당자 {session.displayName}
          </span>
        ) : null}
      </p>
    </div>
  );
}

const TOP_BAR_LINK_CLASS_NAME = cn(
  "hidden h-10 items-center gap-2 rounded-pv2-control border border-pv2-border-strong px-3 pv2-label text-pv2-text hover:bg-pv2-blue-soft md:inline-flex",
  PV2_FOCUS_RING_CLASS_NAME,
);

function PlainFrame({
  session,
  notice,
  children,
}: {
  session: PartnerSession | null;
  notice: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="portal-v2 flex min-h-dvh flex-col">
      <header className="border-b border-pv2-border bg-pv2-surface">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 md:min-h-16 md:px-6">
          <PartnerPendingLink
            href="/partner"
            aria-label="싸트너십 파트너 포털 홈"
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-pv2-control",
              PV2_FOCUS_RING_CLASS_NAME,
            )}
          >
            <span className="pv2-heading text-pv2-text">싸트너십</span>
            <span className="pv2-caption text-pv2-muted">파트너 포털</span>
          </PartnerPendingLink>
          <div className="flex items-center gap-2">
            <PartnerPendingLink
              href="/"
              className={cn(
                "inline-flex h-11 items-center rounded-pv2-control border border-pv2-border-strong px-3 pv2-label text-pv2-text hover:bg-pv2-blue-soft md:h-10",
                PV2_FOCUS_RING_CLASS_NAME,
              )}
            >
              공개 홈
            </PartnerPendingLink>
            {session ? (
              <PartnerLogoutButton
                formClassName="inline-flex"
                size="icon"
                ariaLabel="로그아웃"
                title="로그아웃"
              >
                <LogOut className="h-5 w-5" />
              </PartnerLogoutButton>
            ) : null}
          </div>
        </div>
      </header>
      <main className="flex-1">
        {notice ? (
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-6">{notice}</div>
        ) : null}
        {children}
      </main>
      <footer className="border-t border-pv2-border bg-pv2-surface py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 pv2-caption text-pv2-muted sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p className="text-ko-pretty">
            파트너사 담당자 전용 공간입니다. 정보 변경은 승인 절차를 거칩니다.
          </p>
          <a
            href={TECH_SUPPORT_HREF}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pv2-control pv2-label text-pv2-text hover:text-pv2-blue",
              PV2_FOCUS_RING_CLASS_NAME,
            )}
          >
            기술 지원
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function PartnerPortalShellView({
  children,
  session,
  companies,
  companiesUnavailable = false,
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
  const useDashboardShell = shouldUsePartnerPortalDashboardShell({
    pathname,
    hasSession: Boolean(session),
  });
  const companiesNotice =
    session && companiesUnavailable ? <CompaniesUnavailableNotice /> : null;

  if (!useDashboardShell || !session) {
    return (
      <PlainFrame session={session} notice={companiesNotice}>
        {children}
      </PlainFrame>
    );
  }

  const navGroups = buildNavGroups({
    pathname,
    isMock,
    companyId: currentCompanyId,
  });
  const operationItems = navGroups[0].items;
  const notifications = navGroups[1].items.find((item) => item.id === "notifications");
  const mobileNavItems = [
    ...operationItems.filter((item) => item.id !== "plans"),
    ...(notifications ? [notifications] : []),
  ];

  return (
    <PortalShell
      brand={PORTAL_BRAND}
      scope={<CompanyScope company={currentCompany} />}
      navGroups={navGroups}
      mobileNavItems={mobileNavItems}
      sidebarFooter={<SidebarFooter />}
      topBarStart={
        <TopBarStart
          pathname={pathname}
          isMock={isMock}
          companyId={currentCompanyId}
          company={currentCompany}
          session={session}
        />
      }
      topBarEnd={
        <PartnerPendingLink href="/" className={TOP_BAR_LINK_CLASS_NAME}>
          사용자 화면
          <ExternalLink aria-hidden="true" className="size-4" />
        </PartnerPendingLink>
      }
      notice={companiesNotice}
      linkComponent={PartnerPendingLink}
    >
      {children}
    </PortalShell>
  );
}
