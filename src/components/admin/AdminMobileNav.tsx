"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SITE_NAME } from "@/lib/site";
import {
  type AdminNavGroup,
  isAdminNavActive,
} from "@/components/admin/admin-navigation";

function DrawerSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-muted/70 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function NavButton({
  href,
  label,
  description,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Button
      variant="ghost"
      href={href}
      className={cn(
        "w-full justify-start rounded-2xl px-4",
        active ? "border-strong bg-surface-elevated text-foreground shadow-flat" : null,
      )}
      onClick={onNavigate}
    >
      <span className="grid min-w-0 justify-items-start gap-0.5 text-left">
        <span className="truncate">{label}</span>
        <span className="truncate text-xs font-medium text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
}

export default function AdminMobileNav({
  title,
  description,
  backHref,
  backLabel,
  logoutAction,
  navGroups,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
  navGroups: AdminNavGroup[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const opener = menuButtonRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const getFocusableControls = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
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
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-control text-foreground"
        aria-label="관리 메뉴 열기"
        onClick={() => setOpen(true)}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 isolate z-[70] md:hidden" aria-hidden={!open}>
              <button
                type="button"
                className="absolute inset-0 z-0 bg-black/55"
                aria-label="관리 메뉴 닫기"
                onClick={closeMenu}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-label="관리자 메뉴"
                ref={dialogRef}
                tabIndex={-1}
                className="fixed right-0 top-0 z-10 h-full w-[86vw] max-w-sm overflow-hidden rounded-l-[2rem] border-l border-border bg-surface-overlay shadow-overlay"
              >
                <div className="flex h-full flex-col bg-surface-overlay">
                  <div className="border-b border-border px-5 pb-4 pt-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Admin Workspace
                        </p>
                        <p className="mt-1.5 text-base font-semibold text-foreground">
                          {SITE_NAME}
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                          <span>관리 홈</span>
                          <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {title}
                        </div>
                        {description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        ref={closeButtonRef}
                        type="button"
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-control text-foreground"
                        onClick={closeMenu}
                        aria-label="관리 메뉴 닫기"
                      >
                        <svg
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="flex flex-col gap-4">
                      {navGroups.map((group) => (
                        <DrawerSection
                          key={group.label}
                          title={group.label}
                          description="작업할 영역으로 바로 이동합니다."
                        >
                          <div className="grid gap-2">
                            {group.items.map((item) => (
                              <NavButton
                                key={item.href}
                                href={item.href}
                                label={item.label}
                                description={item.description}
                                active={isAdminNavActive(pathname, item.href)}
                                onNavigate={closeMenu}
                              />
                            ))}
                          </div>
                        </DrawerSection>
                      ))}

                      <DrawerSection
                        title="바로가기"
                        description="관리 외 화면으로 이동합니다."
                      >
                        <div className="grid gap-2">
                          {backHref && backLabel ? (
                            <Button
                              variant="ghost"
                              href={backHref}
                              className="w-full justify-start rounded-2xl px-4"
                              onClick={closeMenu}
                            >
                              {backLabel}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            href="/"
                            className="w-full justify-start rounded-2xl px-4"
                            onClick={closeMenu}
                          >
                            사용자 화면
                          </Button>
                        </div>
                      </DrawerSection>

                      <DrawerSection
                        title="계정"
                        description="현재 관리자 세션을 종료합니다."
                      >
                        <AdminLogoutButton
                          action={logoutAction}
                          className="w-full justify-center rounded-2xl"
                        />
                      </DrawerSection>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
