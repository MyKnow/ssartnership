"use client";

import { useState } from "react";
import Button, { type ButtonVariant } from "@/components/ui/Button";

/**
 * Gives server-rendered pagination an immediate acknowledgement while the
 * next RSC payload is prepared, without changing the semantic link or href.
 */
export default function AdminPaginationLink({
  href,
  children,
  variant = "secondary",
  size = "sm",
  prefetch = true,
  disabled = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg" | "icon";
  prefetch?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const isDisabled = disabled || isPending;

  return (
    <>
      <Button
        href={href}
        variant={variant}
        size={size}
        prefetch={prefetch}
        disabled={isDisabled}
        loading={isPending}
        loadingText="불러오는 중"
        className={className}
        onClick={(event) => {
          if (isDisabled || event.defaultPrevented) {
            return;
          }
          setIsPending(true);
        }}
      >
        {children}
      </Button>
      {isPending ? (
        <span className="sr-only" aria-live="polite">
          페이지를 불러오는 중입니다.
        </span>
      ) : null}
    </>
  );
}
