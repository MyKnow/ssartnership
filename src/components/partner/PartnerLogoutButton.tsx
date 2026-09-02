"use client";

import { type ComponentProps, useState } from "react";
import Button from "@/components/ui/Button";

type PartnerLogoutButtonProps = Omit<
  ComponentProps<typeof Button>,
  | "disabled"
  | "form"
  | "formAction"
  | "href"
  | "loading"
  | "onClick"
  | "prefetch"
  | "rel"
  | "target"
  | "type"
> & {
  formClassName?: string;
};

export default function PartnerLogoutButton({
  children,
  formClassName,
  loadingText = "로그아웃 중",
  variant = "danger",
  ...buttonProps
}: PartnerLogoutButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isIconOnly = buttonProps.size === "icon";

  return (
    <form
      action="/partner/logout"
      method="post"
      className={formClassName}
      onSubmit={() => setIsSubmitting(true)}
    >
      <Button
        {...buttonProps}
        type="submit"
        variant={variant}
        loading={isSubmitting}
        loadingText={loadingText}
      >
        {children}
      </Button>
      {isIconOnly ? (
        <span role="status" aria-live="polite" className="sr-only">
          {isSubmitting ? loadingText : ""}
        </span>
      ) : null}
    </form>
  );
}
