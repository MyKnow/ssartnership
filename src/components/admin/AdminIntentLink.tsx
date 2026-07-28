"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

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
  const prefetchOnIntent = useCallback(() => {
    if (hasPrefetchedRef.current) {
      return;
    }
    hasPrefetchedRef.current = true;
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={prefetchOnIntent}
      onFocus={prefetchOnIntent}
      {...anchorProps}
    >
      {children}
    </Link>
  );
}
