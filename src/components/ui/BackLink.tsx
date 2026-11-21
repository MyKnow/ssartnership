import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";

/**
 * Explicit parent-destination back link. Use it instead of `router.back()` or
 * inline "← …" text so direct entries (shared links, notifications) still land
 * on a predictable screen. `PageHeader backHref` renders this component.
 */
export default function BackLink({
  href,
  children = "이전 화면으로",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ui-caption inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-1 text-muted-foreground transition-interactive hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        className,
      )}
    >
      <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
