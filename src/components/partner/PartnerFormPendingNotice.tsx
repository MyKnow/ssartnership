"use client";

import { useFormStatus } from "react-dom";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

export default function PartnerFormPendingNotice({
  message = "요청 처리 중입니다. 잠시만 기다려 주세요.",
  className,
}: {
  message?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-[0.9rem] border border-primary/15 bg-primary-soft px-3 py-2 text-xs font-semibold leading-5 text-primary",
        className,
      )}
    >
      <Spinner className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}
