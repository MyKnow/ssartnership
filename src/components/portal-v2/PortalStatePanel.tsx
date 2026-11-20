import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PortalStateKind = "empty" | "loading" | "error" | "forbidden";

const kindClassNames: Record<PortalStateKind, string> = {
  empty: "border-pv2-border bg-pv2-surface",
  loading: "border-pv2-border bg-pv2-surface",
  error: "border-pv2-danger/30 bg-pv2-danger-soft",
  forbidden: "border-pv2-warning/30 bg-pv2-warning-soft",
};

const titleClassNames: Record<PortalStateKind, string> = {
  empty: "text-pv2-text",
  loading: "text-pv2-text",
  error: "text-pv2-danger",
  forbidden: "text-pv2-warning",
};

/**
 * 데이터 상태 패널(Figma "06 · 데이터 상태").
 * - empty: 선택 범위에 기록 없음. 미수집·권한 없음과 구분하고 다음 행동을 준다.
 * - error: 원인 대신 복구 경로. 선택한 필터·입력은 호출부가 유지한다.
 * - forbidden: 서버 인가 결과를 안내만 한다(인가를 대신하지 않음).
 */
export default function PortalStatePanel({
  kind,
  title,
  description,
  action,
  className,
}: {
  kind: PortalStateKind;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const isAlert = kind === "error";
  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-busy={kind === "loading" || undefined}
      className={cn(
        "flex min-w-0 flex-col items-start gap-2 rounded-pv2-panel border p-4 md:p-6",
        kindClassNames[kind],
        className,
      )}
    >
      {kind === "loading" ? (
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-pv2-grid border-t-pv2-blue motion-reduce:animate-none"
        />
      ) : null}
      <p className={cn("pv2-label text-ko-title", titleClassNames[kind])}>{title}</p>
      {description ? (
        <p className="pv2-body text-ko-pretty text-pv2-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2 flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
