"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const focusableSelector = [
  "a[href]",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
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
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const [firstFocusable] = getFocusableElements(panel);
      (firstFocusable ?? panel).focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (openerRef.current?.isConnected) {
        openerRef.current.focus();
      }
    };
  }, [open]);

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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface-control text-foreground shadow-flat transition-interactive duration-200 ease-out hover:-translate-y-px hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-overlay"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className={cn("mt-4 min-h-0 flex-1", bodyClassName)}>
            {children}
          </div>
        </div>
      </div>
    ) : null,
    portalRoot,
  );
}
