import { cn } from "@/lib/cn";
import { PortalButtonLink } from "./PortalButton";

/**
 * 목록 하단 안내 + 이전/다음. URL query가 페이지의 단일 기준이므로 버튼은 링크이며,
 * 이동할 수 없으면 `href`를 비워 비활성(`aria-disabled`)으로 표시한다.
 */
export default function PortalPagination({
  summary,
  page,
  pageCount,
  prevHref,
  nextHref,
  className,
}: {
  /** 예: "2개 예시"가 아니라 "전체 84건" 같은 실제 합계. */
  summary: string;
  page: number;
  pageCount: number;
  prevHref?: string;
  nextHref?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="페이지 이동"
      className={cn("flex min-w-0 flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="pv2-caption text-pv2-muted" aria-live="polite">
        {summary} · {page} / {pageCount}
      </p>
      <div className="flex items-center gap-3">
        <PortalButtonLink
          href={prevHref ?? "#"}
          aria-disabled={prevHref ? undefined : true}
          tabIndex={prevHref ? undefined : -1}
          rel="prev"
        >
          이전
        </PortalButtonLink>
        <PortalButtonLink
          href={nextHref ?? "#"}
          aria-disabled={nextHref ? undefined : true}
          tabIndex={nextHref ? undefined : -1}
          rel="next"
        >
          다음
        </PortalButtonLink>
      </div>
    </nav>
  );
}
