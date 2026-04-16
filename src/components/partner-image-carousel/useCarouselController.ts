"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCachedImageUrl,
  isCachedImageUrlPreloaded,
  preloadCachedImageUrls,
} from "@/lib/image-cache";
import {
  clampCarouselZoom,
  getDesktopThumbPlacement,
  normalizeCarouselIndex,
} from "./helpers";
import type { CarouselOffset, CarouselThumbPlacement } from "./types";

export function useCarouselController({
  images,
  matchHeightSelector,
}: {
  images: string[];
  matchHeightSelector?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CarouselOffset>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<CarouselOffset>({ x: 0, y: 0 });
  const offsetStartRef = useRef<CarouselOffset>({ x: 0, y: 0 });
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const cachedImages = useMemo(
    () => safeImages.map((image) => getCachedImageUrl(image)),
    [safeImages],
  );
  const hasImages = cachedImages.length > 0;
  const imageCount = cachedImages.length;
  const activeImage = hasImages ? cachedImages[activeIndex] : "";
  const canNavigate = imageCount > 1;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const thumbStripRef = useRef<HTMLDivElement | null>(null);
  const [thumbPlacement, setThumbPlacement] =
    useState<CarouselThumbPlacement>("side");
  const [isPreloaded, setIsPreloaded] = useState(
    () =>
      cachedImages.length === 0 ||
      cachedImages.every((url) => isCachedImageUrlPreloaded(url)),
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
    return;
  }, [isOpen]);

  useEffect(() => {
    if (!hasImages) {
      return;
    }
    if (cachedImages.every((url) => isCachedImageUrlPreloaded(url))) {
      return;
    }

    let cancelled = false;
    void preloadCachedImageUrls(cachedImages).then(() => {
      if (!cancelled) {
        setIsPreloaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cachedImages, hasImages]);

  useEffect(() => {
    if (!hasImages || !isPreloaded || isOpen || imageCount <= 1) {
      return;
    }
    if (!window.matchMedia("(min-width: 1280px) and (pointer: fine)").matches) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % imageCount);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }, 3000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasImages, imageCount, isOpen, isPreloaded]);

  useEffect(() => {
    const thumb = activeThumbRef.current;
    const strip = thumbStripRef.current;
    if (!thumb || !strip) {
      return;
    }

    const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
    if (isDesktop && thumbPlacement === "side") {
      const targetTop =
        thumb.offsetTop - strip.clientHeight / 2 + thumb.offsetHeight / 2;
      const nextTop = Math.max(
        0,
        Math.min(targetTop, strip.scrollHeight - strip.clientHeight),
      );
      strip.scrollTo({ top: nextTop, behavior: "smooth" });
      return;
    }

    thumb.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex, thumbPlacement]);

  useEffect(() => {
    if (!matchHeightSelector || typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(min-width: 1280px)");
    let observer: ResizeObserver | null = null;
    let rootObserver: ResizeObserver | null = null;

    const syncLayout = () => {
      if (!media.matches) {
        setThumbPlacement("side");
        return;
      }
      const root = rootRef.current;
      const target = document.querySelector(matchHeightSelector);
      if (!(root instanceof HTMLElement) || !(target instanceof HTMLElement)) {
        setThumbPlacement("side");
        return;
      }
      setThumbPlacement(
        getDesktopThumbPlacement({
          containerWidth: root.getBoundingClientRect().width,
          targetHeight: target.getBoundingClientRect().height,
          imageCount,
        }),
      );
    };

    if (rootRef.current instanceof HTMLElement) {
      rootObserver = new ResizeObserver(() => {
        syncLayout();
      });
      rootObserver.observe(rootRef.current);
    }

    const target = document.querySelector(matchHeightSelector);
    if (target instanceof HTMLElement) {
      observer = new ResizeObserver(() => {
        syncLayout();
      });
      observer.observe(target);
    }

    syncLayout();
    media.addEventListener("change", syncLayout);
    window.addEventListener("resize", syncLayout);

    return () => {
      observer?.disconnect();
      rootObserver?.disconnect();
      media.removeEventListener("change", syncLayout);
      window.removeEventListener("resize", syncLayout);
    };
  }, [imageCount, matchHeightSelector]);

  const resetInteractiveState = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const activateImage = (nextIndex: number) => {
    if (!canNavigate) {
      return;
    }
    setActiveIndex(normalizeCarouselIndex(nextIndex, imageCount));
    resetInteractiveState();
  };

  const goNext = () => activateImage(activeIndex + 1);
  const goPrev = () => activateImage(activeIndex - 1);

  const handleZoom = (value: number | ((prev: number) => number)) => {
    setZoom((prev) =>
      clampCarouselZoom(typeof value === "function" ? value(prev) : value),
    );
  };

  const handlePanStart = (x: number, y: number) => {
    if (zoom <= 1) {
      return;
    }
    isPanningRef.current = true;
    panStartRef.current = { x, y };
    offsetStartRef.current = { ...offset };
  };

  const handlePanMove = (x: number, y: number) => {
    if (!isPanningRef.current) {
      return;
    }
    const dx = x - panStartRef.current.x;
    const dy = y - panStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  };

  const handlePanEnd = () => {
    isPanningRef.current = false;
  };

  return {
    safeImages,
    cachedImages,
    hasImages,
    imageCount,
    activeIndex,
    activeImage,
    canNavigate,
    rootRef,
    activeThumbRef,
    thumbStripRef,
    thumbPlacement,
    isPreloaded,
    isOpen,
    zoom,
    offset,
    setOpen,
    setOffset,
    handleZoom,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    activateImage,
    goNext,
    goPrev,
    resetInteractiveState,
  };
}
