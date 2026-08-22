"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function DeferredImagePreview({
  src,
  alt,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(loading === "eager");

  useEffect(() => {
    if (shouldLoad || loading === "eager") {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = window.setTimeout(() => setShouldLoad(true), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "96px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [loading, shouldLoad]);

  return (
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-card border border-border bg-surface-inset sm:w-28">
      <div ref={containerRef} className="absolute inset-0" aria-hidden={!shouldLoad}>
        {shouldLoad ? (
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized
            loading={loading}
            fetchPriority={loading === "eager" ? "high" : "low"}
            className="object-cover"
            sizes="(max-width: 640px) 96px, 112px"
          />
        ) : null}
      </div>
    </div>
  );
}
