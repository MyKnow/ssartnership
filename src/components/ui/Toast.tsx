"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  const mountedRef = useRef(true);
  const removalTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    const removalTimers = removalTimersRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      removalTimers.forEach((timer) => window.clearTimeout(timer));
      removalTimers.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = removalTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      removalTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
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
      removalTimersRef.current.delete(id);
    }, 2500);
    removalTimersRef.current.set(id, timer);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        data-toast-viewport
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-toast-item
            className="ui-toast-glass pointer-events-auto flex min-h-11 w-full translate-y-0 items-center gap-2 rounded-[1.25rem] py-1 pl-4 pr-1 text-sm text-foreground opacity-100 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none sm:w-auto sm:min-w-[18rem]"
          >
            <span role="status" className="min-w-0 flex-1">
              {toast.message}
            </span>
            <button
              type="button"
              aria-label="알림 닫기"
              title="알림 닫기"
              className="transition-fade-colors inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-control hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-overlay"
              onClick={() => dismiss(toast.id)}
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context ?? noopToastContext;
}
