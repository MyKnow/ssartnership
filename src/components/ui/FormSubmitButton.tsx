"use client";

import { useFormStatus } from "react-dom";
import Button, { type ButtonVariant } from "@/components/ui/Button";

export default function FormSubmitButton({
  children,
  loadingText,
  variant = "primary",
  size = "md",
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  loadingText?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      loading={pending}
      loadingText={loadingText}
      ariaLabel={pending ? loadingText : undefined}
    >
      {children}
    </Button>
  );
}
