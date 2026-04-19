import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Badge from "@/components/ui/Badge";

export const CURRENT_DIFF_BADGE_CLASS =
  "border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100";

export const REQUESTED_DIFF_BADGE_CLASS =
  "border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100";

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
          ? "text-rose-700 dark:text-rose-100"
          : "text-emerald-700 dark:text-emerald-100",
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
          ? "text-rose-700 decoration-rose-300 hover:text-rose-600 dark:text-rose-100 dark:decoration-rose-400"
          : "text-emerald-700 decoration-emerald-300 hover:text-emerald-600 dark:text-emerald-100 dark:decoration-emerald-400",
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
      ? "border-rose-500/20 bg-rose-500/5"
      : "border-emerald-500/20 bg-emerald-500/5";
  const labelClass =
    tone === "current"
      ? "text-rose-700 dark:text-rose-200"
      : "text-emerald-700 dark:text-emerald-200";

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
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
    <div className="rounded-3xl border border-border bg-surface-inset/85 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Badge className="bg-primary/10 text-primary">변경됨</Badge>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
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
