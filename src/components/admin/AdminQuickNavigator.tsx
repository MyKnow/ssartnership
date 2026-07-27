"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  ADMIN_NAV_ICON_BY_KEY,
  findAdminNavItems,
  type AdminNavGroup,
} from "@/components/admin/admin-navigation";
import { buildAdminGlobalSearchHref } from "@/lib/admin-global-search";

type AdminQuickNavigatorContextValue = {
  openNavigator: () => void;
};

const AdminQuickNavigatorContext =
  createContext<AdminQuickNavigatorContextValue | null>(null);

function useAdminQuickNavigator() {
  const context = useContext(AdminQuickNavigatorContext);
  if (!context) {
    throw new Error("AdminQuickNavigatorTrigger는 Provider 안에서 사용해야 합니다.");
  }
  return context;
}

export function AdminQuickNavigatorTrigger({
  compact = false,
  compactLabel,
  className,
}: {
  compact?: boolean;
  compactLabel?: string;
  className?: string;
}) {
  const { openNavigator } = useAdminQuickNavigator();

  return (
    <Button
      variant="secondary"
      size={compact ? "icon" : "md"}
      ariaLabel="빠른 찾기 열기"
      title="빠른 찾기 (⌘K 또는 Ctrl+K)"
      onClick={openNavigator}
      className={cn(
        compact ? "shrink-0" : "min-w-[10.5rem] justify-between",
        className,
      )}
    >
      <MagnifyingGlassIcon className="h-5 w-5 shrink-0" />
      {compact ? (
        compactLabel ? <span>{compactLabel}</span> : null
      ) : (
        <span className="inline-flex items-center gap-3">
          빠른 찾기
          <kbd className="hidden rounded-md border border-border/80 bg-surface-inset px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </span>
      )}
    </Button>
  );
}

export default function AdminQuickNavigatorProvider({
  navGroups,
  children,
}: {
  navGroups: AdminNavGroup[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const [isRoutePending, startRouteTransition] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const items = useMemo(() => findAdminNavItems(query, navGroups), [navGroups, query]);

  const closeNavigator = () => {
    setPendingDestination(null);
    setOpen(false);
  };
  const openNavigator = () => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActiveItemIndex(-1);
    setPendingDestination(null);
    setOpen(true);
  };
  const navigateTo = (href: string) => {
    if (isRoutePending) {
      return;
    }

    setPendingDestination(href);
    startRouteTransition(() => {
      router.push(href);
      closeNavigator();
    });
  };
  const handleGlobalSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = buildAdminGlobalSearchHref(query);
    if (href === "/admin/search") {
      return;
    }
    navigateTo(href);
  };

  const handleQueryKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isRoutePending || items.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveItemIndex((current) => Math.min(current + 1, items.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveItemIndex((current) => Math.max(current - 1, -1));
      return;
    }

    if (event.key === "Enter" && activeItemIndex >= 0) {
      event.preventDefault();
      const item = items[activeItemIndex];
      if (item) {
        navigateTo(item.href);
      }
    }
  };

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (
        !open &&
        !event.defaultPrevented &&
        !event.isComposing &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase("ko-KR") === "k"
      ) {
        event.preventDefault();
        openNavigator();
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    const getFocusableControls = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNavigator();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = getFocusableControls();
      if (controls.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstControl = controls[0]!;
      const lastControl = controls.at(-1)!;
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastControl : firstControl).focus();
      } else if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <AdminQuickNavigatorContext.Provider value={{ openNavigator }}>
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-start justify-center p-3 pt-[max(5rem,env(safe-area-inset-top))] sm:p-6 sm:pt-[max(7rem,env(safe-area-inset-top))]">
              <button
                type="button"
                className="absolute inset-0 bg-foreground/30"
                aria-label="빠른 찾기 배경 닫기"
                onClick={closeNavigator}
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-quick-navigator-title"
                aria-busy={isRoutePending || undefined}
                tabIndex={-1}
                className="relative grid max-h-[min(42rem,calc(100dvh-6rem))] w-full max-w-2xl overflow-hidden rounded-overlay border border-border/80 bg-surface-overlay shadow-overlay"
              >
                <div className="border-b border-border/70 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="ui-kicker">바로 이동</p>
                      <h2 id="admin-quick-navigator-title" className="mt-1 text-lg font-semibold text-foreground">
                        빠른 찾기
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        필요한 업무 화면을 이름이나 설명으로 찾습니다.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      ariaLabel="빠른 찾기 닫기"
                      title="닫기"
                      onClick={closeNavigator}
                    >
                      <span aria-hidden="true">×</span>
                    </Button>
                  </div>
                  <label className="sr-only" htmlFor="admin-quick-navigator-query">
                    관리 화면 찾기
                  </label>
                  <form onSubmit={handleGlobalSearchSubmit} className="mt-4 flex items-center gap-3 rounded-control border border-border bg-surface-inset px-3">
                    <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <input
                      ref={inputRef}
                      id="admin-quick-navigator-query"
                      type="search"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveItemIndex(-1);
                      }}
                      onKeyDown={handleQueryKeyDown}
                      placeholder="예: 변경 승인, 회원, 발송"
                      disabled={isRoutePending}
                      aria-controls="admin-quick-navigator-results"
                      aria-activedescendant={
                        activeItemIndex >= 0
                          ? `admin-quick-navigator-option-${activeItemIndex}`
                          : undefined
                      }
                      className="h-12 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      disabled={isRoutePending}
                      ariaLabel="회원·제휴처 검색"
                      title="회원·제휴처 검색"
                    >
                      <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  </form>
                </div>

                <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
                  {isRoutePending ? (
                    <p className="mb-3 text-sm font-medium text-muted-foreground" role="status" aria-live="polite">
                      {pendingDestination?.startsWith("/admin/search")
                        ? "검색 결과를 여는 중입니다."
                        : "선택한 관리 화면을 여는 중입니다."}
                    </p>
                  ) : null}
                  {query.trim() ? (
                    <Link
                      href={buildAdminGlobalSearchHref(query)}
                      prefetch={false}
                      aria-disabled={isRoutePending || undefined}
                      tabIndex={isRoutePending ? -1 : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateTo(buildAdminGlobalSearchHref(query));
                      }}
                      className={cn(
                        "group mb-3 flex min-h-14 min-w-0 items-center gap-3 rounded-card border border-primary/15 bg-primary-soft px-3 py-3 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isRoutePending ? "pointer-events-none opacity-60" : null,
                      )}
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-control text-primary">
                        <MagnifyingGlassIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">
                          “{query.trim()}”에서 회원·제휴처 검색
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          실제 대상 결과를 열어 상세 화면으로 바로 이동합니다.
                        </span>
                      </span>
                      <ArrowRightIcon className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ) : null}
                  <div
                    id="admin-quick-navigator-results"
                    className="grid gap-2"
                    role={items.length > 0 ? "listbox" : undefined}
                    aria-label={items.length > 0 ? "찾은 관리 화면" : undefined}
                  >
                    {items.length > 0 ? (
                      items.map((item, itemIndex) => {
                        const Icon = ADMIN_NAV_ICON_BY_KEY[item.iconKey];
                        return (
                          <div
                            key={item.href}
                            id={`admin-quick-navigator-option-${itemIndex}`}
                            role="option"
                            aria-selected={activeItemIndex === itemIndex}
                            onMouseEnter={() => setActiveItemIndex(itemIndex)}
                            className={cn(
                              "rounded-card",
                              activeItemIndex === itemIndex
                                ? "ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                                : null,
                            )}
                          >
                            <Link
                              href={item.href}
                              prefetch={false}
                              aria-disabled={isRoutePending || undefined}
                              tabIndex={isRoutePending ? -1 : undefined}
                              onClick={(event) => {
                                event.preventDefault();
                                navigateTo(item.href);
                              }}
                              className={cn(
                                "group flex min-w-0 items-center gap-3 rounded-card border border-border/70 bg-surface-inset p-3 text-left transition-colors hover:border-strong hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                activeItemIndex === itemIndex
                                  ? "border-primary/45 bg-primary-soft/60"
                                  : null,
                                isRoutePending ? "pointer-events-none opacity-60" : null,
                              )}
                            >
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-muted text-foreground">
                                <Icon className="h-5 w-5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-foreground">
                                  {item.label}
                                </span>
                                <span className="mt-0.5 block text-sm text-muted-foreground">
                                  {item.description}
                                </span>
                              </span>
                              <ArrowRightIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-card border border-border/70 bg-surface-inset p-5 text-sm text-muted-foreground">
                        일치하는 관리 화면이 없습니다. 다른 단어로 다시 찾아보세요.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </AdminQuickNavigatorContext.Provider>
  );
}
