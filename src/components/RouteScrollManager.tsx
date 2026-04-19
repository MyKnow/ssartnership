"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function scrollToTopInstant() {
  if (typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  root.style.scrollBehavior = previousScrollBehavior;
}

export default function RouteScrollManager() {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    scrollToTopInstant();
  }, [pathname]);

  return null;
}
