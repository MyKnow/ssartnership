"use client";

import type { LinkProps } from "next/link";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import { cn } from "@/lib/cn";
import type { ButtonVariant } from "@/components/ui/Button";

const base =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-none transition-interactive duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const sizes = {
  sm: "h-10 rounded-[0.95rem] px-4 text-sm",
  md: "h-11 rounded-[1rem] px-[1.125rem] text-sm",
  lg: "h-12 rounded-[1.05rem] px-5 text-base",
  icon: "h-11 w-11 rounded-[1rem] p-0 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-primary-foreground shadow-raised hover:-translate-y-px hover:bg-primary-emphasis hover-shadow-floating",
  ghost:
    "border-border bg-surface-control text-foreground shadow-flat hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
  danger:
    "border-danger/20 bg-danger/10 text-danger shadow-flat hover:-translate-y-px hover:border-danger/35 hover:bg-danger/12",
  soft:
    "border-primary/10 bg-primary-soft text-primary shadow-flat hover:-translate-y-px hover:border-primary/20 hover:bg-primary-soft/90",
  secondary:
    "border-border/70 bg-surface-muted text-foreground shadow-flat hover:-translate-y-px hover:border-strong hover:bg-surface-control",
};

export default function PartnerPendingButtonLink({
  children,
  href,
  prefetch,
  replace,
  scroll,
  variant = "primary",
  size = "md",
  className,
  ariaLabel,
  title,
  showSpinner,
}: {
  children: React.ReactNode;
  href: LinkProps["href"];
  prefetch?: LinkProps["prefetch"];
  replace?: LinkProps["replace"];
  scroll?: LinkProps["scroll"];
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  className?: string;
  ariaLabel?: string;
  title?: string;
  showSpinner?: boolean;
}) {
  return (
    <PartnerPendingLink
      href={href}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      aria-label={ariaLabel}
      title={title}
      showSpinner={showSpinner}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </PartnerPendingLink>
  );
}
