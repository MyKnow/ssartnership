"use client";

import { useEffect, useRef, useState } from "react";

export function useAutoHideHeader({
  hideThreshold = 24,
  showThreshold = 16,
  topVisibleOffset = 16,
}: {
  hideThreshold?: number;
  showThreshold?: number;
  topVisibleOffset?: number;
} = {}) {
  const [hidden, setHidden] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const accumulatedDeltaRef = useRef(0);

  useEffect(() => {
    const element = headerRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setHeaderHeight(element.offsetHeight);
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    lastScrollYRef.current = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        const delta = currentScrollY - lastScrollYRef.current;

        if (currentScrollY <= Math.max(topVisibleOffset, headerHeight)) {
          setHidden(false);
          accumulatedDeltaRef.current = 0;
        } else if (delta > 0) {
          accumulatedDeltaRef.current = Math.max(0, accumulatedDeltaRef.current);
          accumulatedDeltaRef.current += delta;
          if (accumulatedDeltaRef.current >= hideThreshold) {
            setHidden(true);
            accumulatedDeltaRef.current = 0;
          }
        } else if (delta < 0) {
          accumulatedDeltaRef.current = Math.min(0, accumulatedDeltaRef.current);
          accumulatedDeltaRef.current += delta;
          if (Math.abs(accumulatedDeltaRef.current) >= showThreshold) {
            setHidden(false);
            accumulatedDeltaRef.current = 0;
          }
        }

        lastScrollYRef.current = currentScrollY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headerHeight, hideThreshold, showThreshold, topVisibleOffset]);

  return {
    hidden,
    headerHeight,
    headerRef,
  };
}
