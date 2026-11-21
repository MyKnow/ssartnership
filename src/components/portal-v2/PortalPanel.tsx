import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Panel 규격: padding 24(모바일 16), 기본 gap 16, radius 12, border 1, 그림자 없음.
 * 제목이 있으면 `section`의 접근 가능한 이름으로 연결한다.
 */
export default function PortalPanel({
  title,
  description,
  actions,
  headingLevel = 2,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-pv2-panel border border-pv2-border bg-pv2-surface p-4 md:p-6",
        className,
      )}
    >
      {title || actions ? (
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title ? (
              <Heading id={titleId} className="pv2-heading text-ko-title text-pv2-text">
                {title}
              </Heading>
            ) : null}
            {description ? (
              <p className="mt-1 pv2-body text-ko-pretty text-pv2-muted">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
