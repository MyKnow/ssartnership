"use client";

import { useEffect, useRef, useState } from "react";

export function useHeaderHeight() {
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);

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

  return {
    headerHeight,
    headerRef,
  };
}
