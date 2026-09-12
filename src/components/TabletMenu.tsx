"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import UserMenu from "@/components/auth/UserMenu";
import PwaInstallButton from "@/components/PwaInstallButton";
import ThemeModeButtons from "@/components/ThemeModeButtons";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import type { HeaderSession } from "@/lib/header-session";
import { buildSettingsHref, isFocusedSiteFlow } from "@/lib/site-navigation";
import { cn } from "@/lib/cn";

const BROWSER_NAVIGATION_ITEMS = [
  { label: "홈", href: "/", Icon: HomeIcon, memberOnly: false },
  {
    label: "혜택 검색",
    href: "/#benefit-search",
    Icon: MagnifyingGlassIcon,
    memberOnly: false,
  },
  { label: "쿠폰함", href: "/coupons", Icon: TicketIcon, memberOnly: true },
  { label: "내 정보", href: "/certification", Icon: UserCircleIcon, memberOnly: true },
] as const;

const iconButtonClassName =
  "h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";
// 상단 메뉴·설정은 인증과 알림보다 낮은 톤의 표면으로 구분합니다.
const headerTriggerClassName =
  "h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted text-foreground shadow-flat transition-colors hover:border-strong hover:bg-surface-control focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2";
const menuRowClassName =
  "w-full !justify-start gap-3 !rounded-xl !border-transparent !bg-transparent px-3 !shadow-none focus-visible:!outline-2 focus-visible:!outline-primary focus-visible:!outline-offset-2 hover:!translate-y-0 hover:!bg-surface-control aria-[current=page]:!bg-primary-soft aria-[current=page]:text-primary";

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="px-1 text-xs font-semibold text-muted-foreground">{title}</h3>
      {/* 그룹에만 표면 깊이를 주고, 내부 항목은 같은 높이의 평평한 행으로 맞춥니다. */}
      <Surface padding="none" className="!rounded-2xl p-1">
        {children}
      </Surface>
    </section>
  );
}

export default function TabletMenu({
  initialSession,
  guestAuthReturnTo,
  suggestHref = "/suggest",
}: {
  initialSession?: HeaderSession | null;
  guestAuthReturnTo?: string;
  suggestHref?: string;
}) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<{ kind: "menu" | "settings"; pathname: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const titleId = useId();
  const signedIn = Boolean(initialSession);
  // 브라우저 뒤로/앞으로 이동해도 이전 경로의 열린 패널을 다시 표시하지 않습니다.
  if (panel && panel.pathname !== pathname) setPanel(null);
  const open = panel !== null && panel.pathname === pathname;
  const settingsOnly = panel?.kind === "settings";
  const title = settingsOnly ? "설정" : "메뉴";

  const navigationItems = (memberOnly: boolean) => BROWSER_NAVIGATION_ITEMS
    .filter((item) => item.memberOnly === memberOnly)
    .map((item) => {
      const href = item.memberOnly && !signedIn
        ? `/auth/login?returnTo=${encodeURIComponent(item.href)}`
        : item.href;
      const Icon = item.Icon;
      return (
        <Button key={item.label} variant="ghost" href={href} prefetch={false}
          ariaCurrent={href === pathname ? "page" : undefined} className={menuRowClassName}>
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {item.label}
        </Button>
      );
    });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // native dialog로 배경의 클릭과 포커스를 차단합니다.
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      const visibleTrigger = opener?.getClientRects().length ? opener :
        Array.from(document.querySelectorAll<HTMLButtonElement>(
          "[data-site-browser-menu-trigger], [data-site-app-settings-trigger]",
        )).find((element) => element.getClientRects().length > 0);
      visibleTrigger?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-site-browser-menu-trigger
        className={cn(headerTriggerClassName, "inline-flex")}
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-expanded={open && !settingsOnly}
        onClick={(event) => {
          openerRef.current = event.currentTarget;
          setPanel({ kind: "menu", pathname });
        }}
      >
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-site-app-settings-trigger
        className={cn(headerTriggerClassName, "hidden")}
        aria-label="설정 열기"
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-expanded={open && settingsOnly}
        onClick={(event) => {
          openerRef.current = event.currentTarget;
          setPanel({ kind: "settings", pathname });
        }}
      >
        <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* 닫혀 있어도 설치 버튼을 마운트해 메뉴를 열기 전의 설치 가능 이벤트를 보존합니다. */}
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/55"
        onCancel={() => setPanel(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setPanel(null);
            return;
          }
          if (event.key !== "Tab") return;
          // 브라우저 주소창으로 빠지지 않도록 패널의 첫/마지막 액션을 연결합니다.
          const actions = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex="0"]',
          )).filter((element) => element.getClientRects().length > 0);
          const first = actions[0];
          const last = actions.at(-1);
          if (event.shiftKey && document.activeElement === first && last) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last && first) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPanel(null);
        }}
      >
        <div
          className="absolute inset-y-0 right-0 flex w-[90vw] max-w-sm flex-col overflow-hidden rounded-l-[var(--radius-panel)] border-l border-border bg-background shadow-overlay"
          onClick={(event) => {
            // 로그인·회원가입·설치 안내를 포함해 같은 탭에서 링크로 이동하면 닫습니다.
            if (event.target instanceof Element && event.target.closest("a[href]") &&
                !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
              setPanel(null);
            }
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col bg-surface-overlay">
            <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
              <button
                type="button"
                className={cn(iconButtonClassName, "inline-flex")}
                onClick={() => setPanel(null)}
                aria-label={`${title} 닫기`}
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-surface-inset px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5">
              {!settingsOnly ? (
                <MenuGroup title="탐색">
                  <nav aria-label="전체 메뉴 탐색">{navigationItems(false)}</nav>
                </MenuGroup>
              ) : null}
              <MenuGroup title="계정">
                {!settingsOnly ? navigationItems(true) : null}
                {signedIn && !isFocusedSiteFlow(pathname) ? (
                  <Button variant="ghost" href={buildSettingsHref(pathname)} prefetch={false} className={menuRowClassName}>
                    <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
                    계정 설정
                  </Button>
                ) : null}
                <UserMenu
                  initialSession={initialSession}
                  guestAuthReturnTo={guestAuthReturnTo}
                  className={cn(
                    "flex-col items-stretch !gap-0",
                    (!settingsOnly || (signedIn && !isFocusedSiteFlow(pathname))) && "mt-1 border-t border-border/60 pt-1",
                  )}
                  buttonClassName={menuRowClassName}
                  showMemberNavigation={false}
                  showAuthIcons
                />
              </MenuGroup>
              <MenuGroup title="앱·서비스">
                <div className="space-y-2 px-3 pb-3 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">화면 모드</p>
                  <ThemeModeButtons compact />
                </div>
                {!settingsOnly ? (
                  <Button variant="ghost" href={suggestHref} className={menuRowClassName}>
                    <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
                    제휴 제안하기
                  </Button>
                ) : null}
                <PwaInstallButton hideWhenInstalled variant="ghost" className={menuRowClassName} />
              </MenuGroup>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
