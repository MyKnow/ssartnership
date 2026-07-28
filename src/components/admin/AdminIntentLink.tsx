"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { markAdminPrefetchIntent } from "@/lib/admin-prefetch";

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
  const prefetchOnIntent = useCallback((trigger: "hover" | "focus") => {
    if (hasPrefetchedRef.current || !markAdminPrefetchIntent(href, trigger)) {
      return;
    }
    hasPrefetchedRef.current = true;
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => prefetchOnIntent("hover")}
      onFocus={() => prefetchOnIntent("focus")}
      {...anchorProps}
    >
      {children}
    </Link>
  );
}
