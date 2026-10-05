import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Badge from "@/components/ui/Badge";

export const CURRENT_DIFF_BADGE_CLASS =
  "border border-danger/15 bg-danger/10 text-danger border-danger/20 bg-danger/15 text-danger";

export const REQUESTED_DIFF_BADGE_CLASS =
  "border border-success/15 bg-success/10 text-success border-success/20 bg-success/15 text-success";

export function ListChips({
  values,
  emptyText,
  badgeClassName = "bg-surface text-foreground",
}: {
  values: string[];
  emptyText: string;
  badgeClassName?: string;
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} className={badgeClassName}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

export function arraysEqual<T>(a: T[], b: T[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

export function formatRange(start: string | null, end: string | null) {
  return `${start ?? "미정"} ~ ${end ?? "미정"}`;
}

export function DiffText({
  tone,
  children,
}: {
  tone: "current" | "requested";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "break-words text-sm font-medium leading-6",
        tone === "current"
          ? "text-danger text-danger"
          : "text-success text-success",
      )}
    >
      {children}
    </div>
  );
}

export function DiffLink({
  tone,
  href,
}: {
  tone: "current" | "requested";
  href: string | null;
}) {
  if (!href) {
    return <DiffText tone={tone}>없음</DiffText>;
  }

  return (
    <a
      className={cn(
        "break-all text-sm font-medium leading-6 underline decoration-1 underline-offset-4",
        tone === "current"
          ? "text-danger decoration-rose-300 hover:text-danger text-danger dark:decoration-rose-400"
          : "text-success decoration-emerald-300 hover:text-success text-success dark:decoration-emerald-400",
      )}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {href}
    </a>
  );
}

export function DiffPanel({
  tone,
  label,
  children,
}: {
  tone: "current" | "requested";
  label: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "current"
      ? "border-danger/20 bg-danger/5"
      : "border-success/20 bg-success/5";
  const labelClass =
    tone === "current"
      ? "text-danger text-danger"
      : "text-success text-success";

  return (
    <div className={cn("min-w-0 rounded-2xl border p-4", toneClass)}>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", labelClass)}>
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function DiffCard({
  label,
  current,
  requested,
}: {
  label: string;
  current: ReactNode;
  requested: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-border bg-surface-inset/85 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Badge className="bg-primary/10 text-primary">변경됨</Badge>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <DiffPanel tone="current" label="현재">
          {current}
        </DiffPanel>
        <DiffPanel tone="requested" label="요청">
          {requested}
        </DiffPanel>
      </div>
    </div>
  );
}
