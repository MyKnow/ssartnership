"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import {
  ADMIN_PREFETCH_HOVER_DELAY_MS,
  markAdminPrefetchIntent,
} from "@/lib/admin-prefetch";

type AdminIntentLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onFocus" | "onPointerEnter"
> & {
  href: string;
  children: ReactNode;
};

/**
 * Prefetches one low-cardinality admin destination only after a user signals
 * intent. Keeping Link prefetch disabled avoids loading every private admin
 * route just because it is visible in the viewport.
 */
export default function AdminIntentLink({
  href,
  children,
  ...anchorProps
}: AdminIntentLinkProps) {
  const router = useRouter();
  const hasPrefetchedRef = useRef(false);
  const hoverTimerRef = useRef<number | null>(null);
  const requestPrefetch = useCallback((trigger: "hover" | "focus") => {
    if (hasPrefetchedRef.current || !markAdminPrefetchIntent(href, trigger)) {
      return;
    }
    hasPrefetchedRef.current = true;
    router.prefetch(href);
  }, [href, router]);
  const prefetchOnIntent = useCallback((trigger: "hover" | "focus") => {
    if (trigger === "hover") {
      if (hoverTimerRef.current !== null) {
        return;
      }
      hoverTimerRef.current = window.setTimeout(() => {
        hoverTimerRef.current = null;
        requestPrefetch("hover");
      }, ADMIN_PREFETCH_HOVER_DELAY_MS);
      return;
    }

    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    requestPrefetch("focus");
  }, [requestPrefetch]);
  const cancelHoverPrefetch = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  return (
    <Link
      href={href}
      prefetch={false}
      {...anchorProps}
      onPointerEnter={() => prefetchOnIntent("hover")}
      onPointerLeave={cancelHoverPrefetch}
      onFocus={() => prefetchOnIntent("focus")}
    >
      {children}
    </Link>
  );
}
