"use client";

import { usePathname } from "next/navigation";
import Button from "@/components/ui/Button";
import ErrorDigest from "@/components/errors/ErrorDigest";
import { BUG_REPORT_HREF, TECH_SUPPORT_HREF } from "@/lib/support-mail";

/**
 * `page` replaces the whole viewport (root and global error boundaries).
 * `embedded` renders inside a route-group layout so that its navigation shell
 * (MobileNav, Footer, partner portal shell) stays usable after an exception.
 */
export type AppErrorScreenLayout = "page" | "embedded";

type AppErrorScreenProps = {
  code: string;
  title: string;
  description: string;
  digest?: string;
  onRetry?: () => void;
  layout?: AppErrorScreenLayout;
};

const LAYOUT_CLASS_NAMES: Record<AppErrorScreenLayout, string> = {
  page: "flex min-h-screen items-center justify-center bg-background px-4 py-8",
  embedded: "flex min-h-[60vh] items-center justify-center px-4 py-10",
};

export default function AppErrorScreen({
  code,
  title,
  description,
  digest,
  onRetry,
  layout = "page",
}: AppErrorScreenProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isPartnerRoute = pathname.startsWith("/partner");

  const primaryAction = isAdminRoute
    ? {
        href: "/admin/logs",
        label: "로그 조회",
        helper: "오류 코드와 함께 운영 로그를 확인합니다.",
      }
    : isPartnerRoute
      ? {
          href: TECH_SUPPORT_HREF,
          label: "기술 지원",
          helper: "파트너 포털 문제는 기술 지원 템플릿으로 문의합니다.",
        }
      : {
          href: BUG_REPORT_HREF,
          label: "버그 제보",
          helper: "문제가 재현되면 버그 제보 템플릿으로 남깁니다.",
        };

  const secondaryAction = isAdminRoute
    ? { href: "/admin", label: "관리자 홈" }
    : isPartnerRoute
      ? { href: "/partner", label: "파트너 홈" }
      : { href: "/", label: "홈으로 이동" };

  const Root = layout === "page" ? "main" : "div";

  return (
    <Root data-app-error-layout={layout} className={LAYOUT_CLASS_NAMES[layout]}>
      <section className="w-full max-w-xl rounded-[2rem] border border-border bg-surface-elevated p-6 shadow-raised sm:p-8">
        <div className="grid gap-5">
          <div className="grid gap-2 text-center sm:text-left">
            <p className="ui-kicker">{code}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <ErrorDigest digest={digest} />

          <div className="grid gap-2 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
            <p>{primaryAction.helper}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {onRetry ? (
              <Button type="button" onClick={onRetry} className="w-full sm:w-auto">
                다시 시도
              </Button>
            ) : null}
            <Button href={secondaryAction.href} variant="secondary" className="w-full sm:w-auto">
              {secondaryAction.label}
            </Button>
            <Button href={primaryAction.href} className="w-full sm:w-auto">
              {primaryAction.label}
            </Button>
          </div>
        </div>
      </section>
    </Root>
  );
}
