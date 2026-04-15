import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  getPartnerLockCopy,
  getPartnerVisibilityBadgeClass,
} from "@/lib/partner-visibility";
import type { PartnerVisibility } from "@/lib/types";

export default function PartnerCardLockState({
  lockKind,
  visibility,
  className,
}: {
  lockKind: "confidential" | "private";
  visibility: PartnerVisibility;
  className?: string;
}) {
  const lockCopy = getPartnerLockCopy(lockKind);

  return (
    <article
      className={cn(
        "relative flex h-full w-full overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-surface-overlay p-5 shadow-[var(--shadow-flat)] backdrop-blur-md",
        className,
      )}
      aria-label={lockCopy.title}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.22),_transparent_60%),linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.14))]"
      />
      <div
        aria-hidden="true"
        className="relative flex w-full flex-col gap-4 blur-[2px] saturate-50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="h-7 w-20 rounded-full bg-slate-300/40 dark:bg-slate-700/50" />
          <div className="h-4 w-24 rounded-full bg-slate-300/30 dark:bg-slate-700/40" />
        </div>
        <div className="flex items-start gap-4">
          <div className="aspect-square w-28 shrink-0 rounded-2xl bg-slate-300/35 dark:bg-slate-700/45" />
          <div className="grid flex-1 gap-3 pt-2">
            <div className="h-6 w-3/4 rounded-full bg-slate-300/35 dark:bg-slate-700/45" />
            <div className="h-4 w-full rounded-full bg-slate-300/30 dark:bg-slate-700/40" />
            <div className="h-4 w-5/6 rounded-full bg-slate-300/20 dark:bg-slate-700/30" />
          </div>
        </div>
        <div className="grid gap-3">
          <div className="h-4 w-24 rounded-full bg-slate-300/35 dark:bg-slate-700/45" />
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-24 rounded-full bg-slate-300/30 dark:bg-slate-700/40" />
            <div className="h-8 w-20 rounded-full bg-slate-300/20 dark:bg-slate-700/30" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/65 px-6 text-center backdrop-blur-2xl">
        <div className="max-w-xs">
          <Badge
            className={cn(
              "mb-3",
              getPartnerVisibilityBadgeClass(visibility),
            )}
          >
            {lockCopy.badge}
          </Badge>
          <p className="text-lg font-semibold text-white">{lockCopy.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {lockCopy.description}
          </p>
        </div>
      </div>
    </article>
  );
}
