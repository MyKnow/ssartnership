"use client";

import { useFormStatus } from "react-dom";
import Button from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/Button";
import { useNavigationFormPending } from "@/components/ui/NavigationForm";

export const DEFAULT_SUBMIT_PENDING_TEXT = "처리 중";

/**
 * Form submit button that reads the parent form's pending state: a Server
 * Action form via `useFormStatus`, or a GET filter `NavigationForm` until the
 * next route renders. Loading UI, `disabled`, and `aria-busy` are delegated to
 * `Button`, so a pending form cannot be submitted twice by repeated clicks.
 */
export default function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  form,
  formAction,
  formNoValidate,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  form?: string;
  formAction?: React.ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
  formNoValidate?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending: actionPending } = useFormStatus();
  const navigationPending = useNavigationFormPending();
  const pending = actionPending || navigationPending;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      loading={pending}
      loadingText={pendingText ?? DEFAULT_SUBMIT_PENDING_TEXT}
      form={form}
      formAction={formAction}
      formNoValidate={formNoValidate}
      name={name}
      value={value}
    >
      {children}
    </Button>
  );
}
