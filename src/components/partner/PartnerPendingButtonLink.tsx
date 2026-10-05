"use client";

import type { LinkProps } from "next/link";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import { buttonClassName, type ButtonVariant } from "@/components/ui/Button";

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
  size?: "sm" | "md" | "lg" | "icon";
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
      className={buttonClassName({ variant, size, className })}
    >
      {children}
    </PartnerPendingLink>
  );
}
