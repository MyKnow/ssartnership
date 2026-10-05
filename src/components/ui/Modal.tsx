"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { FOCUS_RING_ON_OVERLAY_CLASS_NAME } from "@/components/ui/focus-ring";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useDialogFocus } from "@/hooks/useDialogFocus";

/**
 * 네이티브 `<dialog>`가 `showModal()`로 열려 있으면 그 바깥은 inert가 되어
 * body에 붙인 모달을 누를 수 없다. 가장 위의 모달 dialog 안에 붙여 top layer를 공유한다.
 */
function resolveModalPortalRoot(open: boolean): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (!open) {
    return document.body;
  }
  try {
    const openNativeModals = Array.from(
      document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
    ).filter((dialog) => dialog.matches(":modal"));
    return openNativeModals.at(-1) ?? document.body;
  } catch {
    return document.body;
  }
}

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  panelClassName,
  titleClassName,
  bodyClassName,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  // 열릴 때마다 붙일 위치를 다시 고른다(메뉴 dialog 안에서 연 확인 모달 등).
  const portalRoot = useMemo(() => resolveModalPortalRoot(open), [open]);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(open);
  useDialogFocus({ open, containerRef: panelRef, onClose });

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    open ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:px-4 sm:py-6">
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/52 backdrop-blur-md"
          onClick={onClose}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            "relative flex w-full max-w-lg flex-col overflow-hidden rounded-overlay border border-border/80 bg-surface-overlay p-4 shadow-overlay backdrop-blur-xl sm:p-6",
            panelClassName,
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id={titleId}
                className={cn(
                  "text-xl font-semibold tracking-[-0.02em] text-foreground",
                  titleClassName,
                )}
              >
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-2 ui-body">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="모달 닫기"
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface-control text-foreground shadow-flat transition-interactive duration-200 ease-out hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
                FOCUS_RING_ON_OVERLAY_CLASS_NAME,
              )}
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className={cn("mt-4 min-h-0 flex-1 overscroll-contain", bodyClassName)}>
            {children}
          </div>
        </div>
      </div>
    ) : null,
    portalRoot,
  );
}
