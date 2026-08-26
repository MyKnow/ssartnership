import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import Spinner from "@/components/ui/Spinner";
import Surface from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

export function CertificationSettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="px-1 text-xs font-semibold text-muted-foreground">
        {title}
      </h2>
      <Surface
        level="default"
        padding="none"
        className="divide-y divide-border/70 overflow-hidden"
      >
        {children}
      </Surface>
    </section>
  );
}

export function CertificationSettingRow({
  icon,
  title,
  description,
  badge,
  href,
  prefetch,
  onClick,
  tone = "default",
  trailingLabel,
  loading = false,
  loadingLabel = "처리 중",
  className,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  badge?: ReactNode;
  href?: string;
  prefetch?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  tone?: "default" | "danger";
  trailingLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
}) {
  const classes = cn(
    "group relative flex min-h-[4.75rem] w-full items-center gap-3 bg-surface px-4 py-3.5 text-left transition-interactive focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-5",
    tone === "danger"
      ? "hover:bg-danger/5 focus-visible:ring-danger/30"
      : "hover:bg-surface-muted/70 focus-visible:ring-primary/30",
    loading ? "cursor-default opacity-70" : "cursor-pointer",
    className,
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border",
          tone === "danger"
            ? "border-danger/15 bg-danger/10 text-danger"
            : "border-border/70 bg-surface-muted text-primary",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              tone === "danger" ? "text-danger" : "text-foreground",
            )}
          >
            {title}
          </span>
          {badge}
        </span>
        <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {loading ? (
          <>
            <Spinner />
            <span className="sr-only">{loadingLabel}</span>
          </>
        ) : (
          <>
            {trailingLabel ? (
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  tone === "danger" ? "text-danger" : "text-muted-foreground",
                )}
              >
                {trailingLabel}
              </span>
            ) : null}
            {href ? (
              <ChevronRightIcon
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            ) : null}
          </>
        )}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={prefetch ?? false} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      disabled={loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
