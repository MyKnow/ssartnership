"use client";

import Link, { type LinkProps, useLinkStatus } from "next/link";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

type PartnerPendingLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> &
  Pick<LinkProps, "href" | "prefetch" | "replace" | "scroll"> & {
    children: React.ReactNode;
    pendingLabel?: string;
    showProgress?: boolean;
    showSpinner?: boolean;
    spinnerClassName?: string;
  };

function PartnerPendingLinkStatus({
  pendingLabel,
  showProgress,
  showSpinner,
  spinnerClassName,
}: {
  pendingLabel: string;
  showProgress: boolean;
  showSpinner: boolean;
  spinnerClassName?: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {pending ? pendingLabel : ""}
      </span>
      {showProgress ? (
        <span
          aria-hidden
          aria-busy={pending || undefined}
          className={cn(
            "pointer-events-none absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded-full bg-current/10 transition-opacity duration-150",
            pending ? "opacity-75" : "opacity-0",
          )}
        >
          <span
            className={cn(
              "block h-full rounded-full bg-current transition-[width] duration-200",
              pending ? "w-full animate-pulse" : "w-0",
            )}
          />
        </span>
      ) : null}
      {showSpinner && pending ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-surface-overlay/85 p-1 shadow-flat",
            spinnerClassName,
          )}
        >
          <Spinner className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </>
  );
}

export default function PartnerPendingLink({
  children,
  className,
  pendingLabel = "이동 중",
  showProgress = true,
  showSpinner = false,
  spinnerClassName,
  prefetch = false,
  ...props
}: PartnerPendingLinkProps) {
  return (
    <Link
      {...props}
      prefetch={prefetch}
      className={cn("relative overflow-hidden", className)}
    >
      {children}
      <PartnerPendingLinkStatus
        pendingLabel={pendingLabel}
        showProgress={showProgress}
        showSpinner={showSpinner}
        spinnerClassName={spinnerClassName}
      />
    </Link>
  );
}
