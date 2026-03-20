"use client";

import { cn } from "@/lib/cn";

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-xl",
        )}
      >
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
