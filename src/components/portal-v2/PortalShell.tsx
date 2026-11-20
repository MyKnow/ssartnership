"use client";

import Link from "next/link";
import { Menu, MoreHorizontal, X } from "lucide-react";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type ComponentType,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { cn } from "@/lib/cn";
import {
  PV2_FOCUS_RING_CLASS_NAME,
  PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
  PV2_TRANSITION_CLASS_NAME,
} from "./portal-v2-classes";
import {
  isPortalMoreNavActive,
  selectPortalMobileNavItems,
  type PortalNavGroup,
  type PortalNavItem,
} from "./portal-shell-navigation";

export type PortalLinkComponent = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  "aria-current"?: "page";
  "aria-label"?: string;
}>;

export type PortalShellProps = {
  /** Product name and area, e.g. 싸트너십 · 파트너 포털. */
  brand: { name: string; area: string; href: string };
  /** Highlighted scope block under the brand (company, campus·cohort). */
  scope?: ReactNode;
  navGroups: PortalNavGroup[];
  /** Up to three bottom-bar destinations on mobile; "더보기" opens the menu. */
  mobileNavItems?: PortalNavItem[];
  /** Pinned to the bottom of the sidebar and the mobile menu (account, logout). */
  sidebarFooter?: ReactNode;
  /** Left side of the top bar (current scope, search). */
  topBarStart?: ReactNode;
  /** Right side of the top bar (notifications, profile). */
  topBarEnd?: ReactNode;
  /** Inline notice rendered above the page content. */
  notice?: ReactNode;
  linkComponent?: PortalLinkComponent;
  children: ReactNode;
};

const DefaultLink: PortalLinkComponent = ({ href, children, ...props }) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);

function SidebarNavLink({
  item,
  compact,
  LinkComponent,
  onNavigate,
}: {
  item: PortalNavItem;
  /** Tablet rail: icon only, label exposed to assistive tech and as a tooltip. */
  compact: boolean;
  LinkComponent: PortalLinkComponent;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <LinkComponent
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      aria-label={compact ? item.label : undefined}
      title={compact ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-pv2-control p-3 pv2-label",
        compact && "justify-center",
        item.active
          ? "bg-pv2-nav-active text-pv2-on-dark"
          : "text-pv2-nav-text hover:bg-pv2-nav-active/60 hover:text-pv2-on-dark",
        PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
        PV2_TRANSITION_CLASS_NAME,
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      {compact ? null : (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="shrink-0 rounded-pv2-badge bg-pv2-blue px-2 pv2-caption text-white">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </LinkComponent>
  );
}

function SidebarNavGroups({
  groups,
  compact,
  LinkComponent,
  onNavigate,
  labelledBy,
}: {
  groups: PortalNavGroup[];
  compact: boolean;
  LinkComponent: PortalLinkComponent;
  onNavigate?: () => void;
  labelledBy?: string;
}) {
  return (
    <nav aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : "주요 메뉴"} className="flex min-w-0 flex-col gap-2">
      {groups.map((group) => (
        <div key={group.id} className="flex min-w-0 flex-col gap-2">
          {group.label ? (
            <p className={cn("px-0 pv2-caption text-pv2-nav-text", compact && "sr-only")}>
              {group.label}
            </p>
          ) : null}
          <ul className="flex min-w-0 flex-col gap-2">
            {group.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <SidebarNavLink
                  item={item}
                  compact={compact}
                  LinkComponent={LinkComponent}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({
  brand,
  compact,
  LinkComponent,
}: {
  brand: PortalShellProps["brand"];
  compact: boolean;
  LinkComponent: PortalLinkComponent;
}) {
  return (
    <LinkComponent
      href={brand.href}
      aria-label={`${brand.name} ${brand.area} 홈`}
      className={cn(
        "flex min-h-12 min-w-0 items-center gap-2 rounded-pv2-control",
        compact && "justify-center",
        PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
      )}
    >
      <span className={cn("pv2-heading whitespace-nowrap text-pv2-on-dark", compact && "sr-only")}>
        {brand.name}
      </span>
      <span className={cn("min-w-0 truncate pv2-caption text-pv2-nav-text", compact && "sr-only")}>
        {brand.area}
      </span>
      {compact ? (
        <span aria-hidden="true" className="pv2-heading text-pv2-on-dark">
          {brand.name.slice(0, 1)}
        </span>
      ) : null}
    </LinkComponent>
  );
}

function MobileMenu({
  open,
  onClose,
  brand,
  scope,
  navGroups,
  sidebarFooter,
  LinkComponent,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  brand: PortalShellProps["brand"];
  scope?: ReactNode;
  navGroups: PortalNavGroup[];
  sidebarFooter?: ReactNode;
  LinkComponent: PortalLinkComponent;
  titleId: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useDialogFocus({ open, containerRef: panelRef, onClose });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="메뉴 닫기"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-pv2-text/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-pv2-sidebar outline-hidden"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4">
          <p id={titleId} className="min-w-0 truncate pv2-label text-pv2-on-dark">
            {brand.name} · {brand.area} 메뉴
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-pv2-control text-pv2-on-dark hover:bg-pv2-nav-active",
              PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
            )}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {scope ? <div className="min-w-0">{scope}</div> : null}
          <SidebarNavGroups
            groups={navGroups}
            compact={false}
            LinkComponent={LinkComponent}
            onNavigate={onClose}
          />
          {sidebarFooter ? (
            <div className="mt-auto flex min-w-0 flex-col gap-2 border-t border-pv2-nav-active pt-4">
              {sidebarFooter}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Portal v2 application shell shared by the partner portal and admin.
 *
 * - Desktop (1200px 이상): 240px navy sidebar + 64px top bar.
 * - Tablet (768–1199px): 72px icon rail + 64px top bar.
 * - Mobile (<768px): 56px header with a menu dialog and a bottom bar.
 *
 * Route matching and authorization stay with the caller: pass `active` on nav
 * items and render only the destinations the session may open.
 */
export default function PortalShell({
  brand,
  scope,
  navGroups,
  mobileNavItems,
  sidebarFooter,
  topBarStart,
  topBarEnd,
  notice,
  linkComponent,
  children,
}: PortalShellProps) {
  const LinkComponent = linkComponent ?? DefaultLink;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuTitleId = useId();
  const bottomItems = mobileNavItems ? selectPortalMobileNavItems(mobileNavItems) : [];
  const moreActive = isPortalMoreNavActive(navGroups, bottomItems);
  const hasBottomBar = bottomItems.length > 0;

  return (
    <div className="portal-v2 min-h-dvh md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] pv2-desktop:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Tablet rail and desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-2 overflow-y-auto bg-pv2-sidebar p-3 md:flex pv2-desktop:p-4">
        <div className="pv2-desktop:hidden">
          <Brand brand={brand} compact LinkComponent={LinkComponent} />
        </div>
        <div className="hidden pv2-desktop:block">
          <Brand brand={brand} compact={false} LinkComponent={LinkComponent} />
        </div>
        {scope ? <div className="hidden min-w-0 pv2-desktop:block">{scope}</div> : null}
        <div className="pv2-desktop:hidden">
          <SidebarNavGroups groups={navGroups} compact LinkComponent={LinkComponent} />
        </div>
        <div className="hidden pv2-desktop:block">
          <SidebarNavGroups groups={navGroups} compact={false} LinkComponent={LinkComponent} />
        </div>
        {sidebarFooter ? (
          <div className="mt-auto hidden min-w-0 flex-col gap-2 pt-4 pv2-desktop:flex">
            {sidebarFooter}
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-3 border-b border-pv2-border bg-pv2-surface px-4 md:h-16 md:gap-4 md:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-pv2-control border border-pv2-border-strong px-3 pv2-label text-pv2-text hover:bg-pv2-blue-soft md:hidden",
              PV2_FOCUS_RING_CLASS_NAME,
            )}
          >
            <Menu aria-hidden="true" className="size-5" />
            메뉴
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">{topBarStart}</div>
          {topBarEnd ? (
            <div className="flex shrink-0 items-center gap-3">{topBarEnd}</div>
          ) : null}
        </header>

        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-6 md:py-6",
            hasBottomBar && "pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6",
          )}
        >
          {notice}
          {children}
        </main>
      </div>

      {hasBottomBar ? (
        <nav
          aria-label="하단 주요 메뉴"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-pv2-border bg-pv2-surface px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <ul className="grid grid-cols-4 gap-2">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="min-w-0">
                  <LinkComponent
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-pv2-control px-1 pv2-caption",
                      item.active
                        ? "bg-pv2-blue-soft font-medium text-pv2-blue"
                        : "text-pv2-muted hover:bg-pv2-grid",
                      PV2_FOCUS_RING_CLASS_NAME,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span className="max-w-full truncate">{item.label}</span>
                  </LinkComponent>
                </li>
              );
            })}
            <li className="min-w-0">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-current={moreActive ? "page" : undefined}
                className={cn(
                  "flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-pv2-control px-1 pv2-caption",
                  moreActive
                    ? "bg-pv2-blue-soft font-medium text-pv2-blue"
                    : "text-pv2-muted hover:bg-pv2-grid",
                  PV2_FOCUS_RING_CLASS_NAME,
                )}
              >
                <MoreHorizontal aria-hidden="true" className="size-5 shrink-0" />
                <span className="max-w-full truncate">더보기</span>
              </button>
            </li>
          </ul>
        </nav>
      ) : null}

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        brand={brand}
        scope={scope}
        navGroups={navGroups}
        sidebarFooter={sidebarFooter}
        LinkComponent={LinkComponent}
        titleId={menuTitleId}
      />
    </div>
  );
}
