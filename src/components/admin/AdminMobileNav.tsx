"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SITE_NAME } from "@/lib/site";

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
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Button
      variant={active ? "primary" : "ghost"}
      href={href}
      className={cn(
        "w-full justify-start rounded-2xl px-4",
        active ? "border-primary" : null,
      )}
    >
      {label}
    </Button>
  );
}

export default function AdminMobileNav({
  title,
  description,
  backHref,
  backLabel,
  logoutAction,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const navItems = [
    { href: "/admin", label: "관리 홈", active: pathname === "/admin" },
    {
      href: "/admin/members",
      label: "회원 관리",
      active: pathname === "/admin/members",
    },
    {
      href: "/admin/companies",
      label: "협력사 관리",
      active: pathname === "/admin/companies",
    },
    {
      href: "/admin/partners",
      label: "브랜드 관리",
      active: pathname === "/admin/partners",
    },
    {
      href: "/admin/push",
      label: "푸시 알림 관리",
      active: pathname === "/admin/push",
    },
    {
      href: "/admin/advertisement",
      label: "홈 광고 관리",
      active: pathname === "/admin/advertisement",
    },
    {
      href: "/admin/event",
      label: "이벤트 관리",
      active: pathname === "/admin/event",
    },
    {
      href: "/admin/reviews",
      label: "리뷰 관리",
      active: pathname === "/admin/reviews",
    },
    {
      href: "/admin/logs",
      label: "로그 조회",
      active: pathname === "/admin/logs",
    },
    {
      href: "/admin/cycle",
      label: "기수 관리",
      active: pathname === "/admin/cycle",
    },
    {
      href: "/admin/style-guide",
      label: "UI 스타일 가이드",
      active: pathname === "/admin/style-guide",
    },
  ];

  return (
    <>
      <button
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
            <div className="fixed inset-0 z-[70] sm:hidden" aria-hidden={!open}>
              <button
                type="button"
                className="absolute inset-0 bg-black/55"
                aria-label="관리 메뉴 닫기"
                onClick={() => setOpen(false)}
              />

              <aside
                role="dialog"
                aria-modal="true"
                className="fixed right-0 top-0 h-full w-[86vw] max-w-sm overflow-hidden rounded-l-[2rem] border-l border-border bg-surface-overlay shadow-[var(--shadow-overlay)]"
              >
                <div className="flex h-full flex-col bg-surface-overlay">
                  <div className="border-b border-border px-6 pb-5 pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Admin Menu
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {SITE_NAME}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {title}
                        </p>
                        {description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-control text-foreground"
                        onClick={() => setOpen(false)}
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

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="flex flex-col gap-4">
                      <DrawerSection
                        title="관리 이동"
                        description="작업할 영역으로 바로 이동합니다."
                      >
                        <div className="grid gap-2">
                          {navItems.map((item) => (
                            <NavButton
                              key={item.href}
                              href={item.href}
                              label={item.label}
                              active={item.active}
                            />
                          ))}
                        </div>
                      </DrawerSection>

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
                            >
                              {backLabel}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            href="/"
                            className="w-full justify-start rounded-2xl px-4"
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
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
