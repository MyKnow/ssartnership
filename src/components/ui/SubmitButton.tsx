"use client";

import { useFormStatus } from "react-dom";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import type { ButtonVariant } from "@/components/ui/Button";

export default function SubmitButton({
  children,
  pendingText,
  variant,
  className,
  form,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  form?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending}
      form={form}
    >
      <span className="inline-flex items-center gap-2">
        {pending ? <Spinner /> : null}
        {pending ? pendingText ?? "처리 중" : children}
      </span>
    </Button>
  );
}
