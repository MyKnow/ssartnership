"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";

export default function ScrollToTopFab({
  threshold = 320,
}: {
  threshold?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onScroll = () => {
      setVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const scrollToTop = () => {
    if (typeof window === "undefined") {
      return;
    }

    const startY = window.scrollY;
    if (startY <= 0) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      window.scrollTo(0, 0);
      return;
    }

    const duration = 320;
    const startTime = window.performance.now();

    const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      window.scrollTo(0, Math.round(startY * (1 - eased)));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-safe-bottom-6 right-6 z-40 transition-all duration-200 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <button
        type="button"
        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-950/18 bg-slate-950/30 text-white transition hover:opacity-90 dark:border-white/30 dark:bg-white/14 dark:text-white"
        aria-label="맨 위로 이동"
        title="맨 위로 이동"
        onClick={scrollToTop}
        style={{
          backdropFilter: "blur(5px) saturate(220%)",
          WebkitBackdropFilter: "blur(5px) saturate(180%)",
          boxShadow:
            "0 12px 30px rgba(15, 23, 42, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
        }}
      >
        <ArrowUpIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
