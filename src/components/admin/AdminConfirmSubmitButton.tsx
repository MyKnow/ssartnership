"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import Button, { type ButtonVariant } from "@/components/ui/Button";
import { DEFAULT_SUBMIT_PENDING_TEXT } from "@/components/ui/SubmitButton";

/**
 * Submit button for irreversible Server Action forms. The trigger opens a
 * confirmation dialog first; confirming submits the surrounding form, after
 * which the trigger stays disabled with `aria-busy` until the action settles.
 */
export default function AdminConfirmSubmitButton({
  children,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  pendingText,
  variant = "danger",
  className,
  disabled,
}: {
  children: React.ReactNode;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const formAnchorRef = useRef<HTMLInputElement>(null);

  const confirm = () => {
    setOpen(false);
    formAnchorRef.current?.form?.requestSubmit();
  };

  return (
    <>
      {/* Unnamed hidden input: locates the owning form without adding a field. */}
      <input ref={formAnchorRef} type="hidden" />
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={disabled}
        loading={pending}
        loadingText={pendingText ?? DEFAULT_SUBMIT_PENDING_TEXT}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <AdminConfirmDialog
        open={open && !pending}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        danger={variant === "danger"}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
      />
    </>
  );
}
