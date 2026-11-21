import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** 어드민 페이지 진입부(v2): 유일한 h1(Title 26·38), 설명, 주요 행동. */
export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 pv2-caption text-pv2-muted">{eyebrow}</p> : null}
        <h1 className="pv2-title text-ko-title text-pv2-text">{title}</h1>
        {description ? (
          <div className="mt-2 max-w-3xl pv2-body text-ko-pretty text-pv2-muted">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
