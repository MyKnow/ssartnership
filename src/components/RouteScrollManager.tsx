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

  const historyNavigationPathRef = useRef<string | null>(null);
  useEffect(() => {
    const onPopState = () => {
      historyNavigationPathRef.current = window.location.pathname;
      try {
        if (window.location.pathname === "/") sessionStorage.setItem("home:return", "1");
        else sessionStorage.removeItem("home:return");
      } catch { /* Optional return state. */ }
    };
    // Mark the return before Next.js handles the same history event.
    window.addEventListener("popstate", onPopState, { capture: true });
    return () => window.removeEventListener("popstate", onPopState, { capture: true });
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    if (historyNavigationPathRef.current !== pathname) scrollToTopInstant();
    historyNavigationPathRef.current = null;
  }, [pathname]);

  return null;
}
