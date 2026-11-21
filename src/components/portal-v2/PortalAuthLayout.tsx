import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 셸 없는 인증 화면(로그인·재설정·초기 설정) 레이아웃. 520px 카드 하나에
 * 유일한 h1과 설명, 폼을 담는다. `.portal-v2` 루트 안에서만 쓴다.
 */
export default function PortalAuthLayout({
  eyebrow,
  title,
  description,
  footer,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[32.5rem] flex-col gap-4 px-4 pb-16 pt-8 md:pt-12">
      <section
        className={cn(
          "flex min-w-0 flex-col gap-6 rounded-pv2-panel border border-pv2-border bg-pv2-surface p-4 md:p-8",
          className,
        )}
      >
        <header className="flex min-w-0 flex-col gap-2">
          {eyebrow ? <p className="pv2-caption text-pv2-blue">{eyebrow}</p> : null}
          <h1 className="pv2-title text-ko-title text-pv2-text">{title}</h1>
          {description ? (
            <p className="pv2-body text-ko-pretty text-pv2-muted">{description}</p>
          ) : null}
        </header>
        {children}
      </section>
      {footer ? <div className="pv2-caption text-ko-pretty text-pv2-muted">{footer}</div> : null}
    </div>
  );
}
