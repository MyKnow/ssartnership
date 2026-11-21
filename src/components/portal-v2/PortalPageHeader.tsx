import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 페이지 진입부: 유일한 h1(Title 26·38), 짧은 설명, 화면별 주요 행동 1개.
 * 주요 행동은 모바일에서 전체 폭으로 늘어난다.
 */
export default function PortalPageHeader({
  title,
  description,
  eyebrow,
  primaryAction,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  primaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 pv2-caption text-pv2-muted">{eyebrow}</p> : null}
        <h1 className="pv2-title text-ko-title text-pv2-text">{title}</h1>
        {description ? (
          <p className="mt-2 pv2-body text-ko-pretty text-pv2-muted">{description}</p>
        ) : null}
      </div>
      {primaryAction ? (
        <div className="flex min-w-0 *:w-full md:*:w-auto">{primaryAction}</div>
      ) : null}
    </header>
  );
}
