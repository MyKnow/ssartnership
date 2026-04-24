"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  panelClassName,
  bodyClassName,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

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

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:px-4 sm:py-6">
          <motion.button
            type="button"
            className="absolute inset-0 bg-slate-950/52 backdrop-blur-md"
            onClick={onClose}
            aria-label="닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          />
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              "relative flex w-full max-w-lg flex-col overflow-hidden rounded-overlay border border-border/80 bg-surface-overlay p-4 shadow-overlay backdrop-blur-xl sm:p-6",
              panelClassName,
            )}
          >
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </h2>
              {description ? (
                <p className="mt-2 ui-body">
                  {description}
                </p>
              ) : null}
            </div>
            <div className={cn("mt-4 min-h-0 flex-1", bodyClassName)}>
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
