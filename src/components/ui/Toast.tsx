"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Toast = {
  id: string;
  message: string;
};

type ToastContextValue = {
  notify: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const noopToastContext: ToastContextValue = {
  notify: () => {},
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const mountedRef = useRef(true);
  const removalTimersRef = useRef<number[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      removalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      removalTimersRef.current = [];
    };
  }, []);

  const notify = useCallback((message: string) => {
    if (!mountedRef.current) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    const timer = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      removalTimersRef.current = removalTimersRef.current.filter(
        (timerId) => timerId !== timer,
      );
    }, 2500);
    removalTimersRef.current = [...removalTimersRef.current, timer];
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:max-w-sm">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="pointer-events-auto w-full rounded-[1.25rem] border border-border/80 bg-surface-overlay px-4 py-3 text-sm text-foreground shadow-overlay backdrop-blur-xl sm:w-auto sm:min-w-[18rem]"
              initial={
                shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }
              }
              transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context ?? noopToastContext;
}
