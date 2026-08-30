"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCachedImageUrl,
  warmCachedImageUrl,
} from "@/lib/image-cache";
import {
  clampCarouselZoom,
  normalizeCarouselIndex,
} from "./helpers";
import type { CarouselOffset, CarouselThumbPlacement } from "./types";

const SWIPE_NAVIGATION_THRESHOLD_PX = 36;
const HORIZONTAL_WHEEL_THRESHOLD_PX = 72;
const HORIZONTAL_WHEEL_GESTURE_IDLE_MS = 180;
const HORIZONTAL_WHEEL_NAVIGATION_INTERVAL_MS = 220;
const HORIZONTAL_WHEEL_COASTING_MIN_DELTA_PX = 12;

export function useCarouselController({
  images,
  thumbPlacement = "bottom",
}: {
  images: string[];
  matchHeightSelector?: string;
  thumbPlacement?: CarouselThumbPlacement;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [navigationDirection, setNavigationDirection] = useState<
    "next" | "previous"
  >("next");
  const [isOpen, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CarouselOffset>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const activeIndexRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);
  const pendingHorizontalWheelDeltaRef = useRef(0);
  const horizontalWheelDirectionRef = useRef<-1 | 0 | 1>(0);
  const horizontalWheelPeakDeltaRef = useRef(0);
  const lastHorizontalWheelNavigationAtRef = useRef(Number.NEGATIVE_INFINITY);
  const horizontalWheelGestureTimerRef = useRef<number | null>(null);
  const ignoreClickAfterSwipeRef = useRef(false);
  const ignoreClickTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

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
    if (!hasImages || cachedImages.length <= 1) {
      return;
    }

    warmCachedImageUrl(cachedImages[activeIndex + 1]);
  }, [activeIndex, cachedImages, hasImages]);

  useEffect(() => {
    const thumb = activeThumbRef.current;
    const strip = thumbStripRef.current;
    if (!thumb || !strip) {
      return;
    }

    const isTabletOrLarger = window.matchMedia("(min-width: 768px)").matches;
    if (isTabletOrLarger && thumbPlacement === "side") {
      const targetTop =
        thumb.offsetTop - strip.clientHeight / 2 + thumb.offsetHeight / 2;
      const nextTop = Math.max(
        0,
        Math.min(targetTop, strip.scrollHeight - strip.clientHeight),
      );
      strip.scrollTo({ top: nextTop, behavior: "smooth" });
      return;
    }

    const targetLeft =
      thumb.offsetLeft - strip.clientWidth / 2 + thumb.offsetWidth / 2;
    const nextLeft = Math.max(
      0,
      Math.min(targetLeft, strip.scrollWidth - strip.clientWidth),
    );
    strip.scrollTo({ left: nextLeft, behavior: "smooth" });
  }, [activeIndex, thumbPlacement]);

  const resetInteractiveState = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const activateImage = (nextIndex: number) => {
    if (!canNavigate) {
      return;
    }
    const nextActiveIndex = normalizeCarouselIndex(nextIndex, imageCount);
    const currentActiveIndex = activeIndexRef.current;
    if (nextActiveIndex !== currentActiveIndex) {
      setNavigationDirection(
        nextActiveIndex > currentActiveIndex ? "next" : "previous",
      );
    }
    activeIndexRef.current = nextActiveIndex;
    setActiveIndex(nextActiveIndex);
    resetInteractiveState();
  };

  const goNext = () => activateImage(activeIndexRef.current + 1);
  const goPrev = () => activateImage(activeIndexRef.current - 1);
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < imageCount - 1;
  const goNextBounded = () => {
    const currentActiveIndex = activeIndexRef.current;
    if (currentActiveIndex < imageCount - 1) {
      activateImage(currentActiveIndex + 1);
    }
  };
  const goPrevBounded = () => {
    const currentActiveIndex = activeIndexRef.current;
    if (currentActiveIndex > 0) {
      activateImage(currentActiveIndex - 1);
    }
  };

  const beginHorizontalSwipe = (clientX: number) => {
    swipeStartXRef.current = clientX;
  };

  const endHorizontalSwipe = (clientX: number) => {
    const startX = swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (startX === null) {
      return false;
    }

    const distance = clientX - startX;
    if (Math.abs(distance) < SWIPE_NAVIGATION_THRESHOLD_PX) {
      return false;
    }

    if (distance < 0) {
      goNextBounded();
    } else {
      goPrevBounded();
    }

    ignoreClickAfterSwipeRef.current = true;
    if (ignoreClickTimerRef.current !== null) {
      window.clearTimeout(ignoreClickTimerRef.current);
    }
    ignoreClickTimerRef.current = window.setTimeout(() => {
      ignoreClickAfterSwipeRef.current = false;
      ignoreClickTimerRef.current = null;
    }, 0);

    return true;
  };

  const cancelHorizontalSwipe = () => {
    swipeStartXRef.current = null;
  };

  const consumeSwipeClick = () => {
    if (!ignoreClickAfterSwipeRef.current) {
      return false;
    }
    ignoreClickAfterSwipeRef.current = false;
    return true;
  };

  const handleHorizontalWheel = (deltaX: number, deltaY: number) => {
    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      return false;
    }

    const direction = deltaX > 0 ? 1 : -1;
    const absoluteDelta = Math.abs(deltaX);
    if (
      horizontalWheelDirectionRef.current !== 0 &&
      horizontalWheelDirectionRef.current !== direction
    ) {
      pendingHorizontalWheelDeltaRef.current = 0;
      horizontalWheelPeakDeltaRef.current = 0;
    }
    horizontalWheelDirectionRef.current = direction;

    if (horizontalWheelGestureTimerRef.current !== null) {
      window.clearTimeout(horizontalWheelGestureTimerRef.current);
    }
    horizontalWheelGestureTimerRef.current = window.setTimeout(() => {
      pendingHorizontalWheelDeltaRef.current = 0;
      horizontalWheelDirectionRef.current = 0;
      horizontalWheelPeakDeltaRef.current = 0;
      horizontalWheelGestureTimerRef.current = null;
    }, HORIZONTAL_WHEEL_GESTURE_IDLE_MS);

    if (absoluteDelta > horizontalWheelPeakDeltaRef.current) {
      horizontalWheelPeakDeltaRef.current = absoluteDelta;
    }

    // A trackpad keeps emitting very small values while it decelerates after
    // the user's fingers stop. Ignore only that individual tail event: never
    // leave the carousel in a sticky "coasting" state, because a subsequent
    // intentional scroll in the same direction must resume immediately.
    if (
      horizontalWheelPeakDeltaRef.current >= HORIZONTAL_WHEEL_THRESHOLD_PX / 3 &&
      absoluteDelta <= HORIZONTAL_WHEEL_COASTING_MIN_DELTA_PX
    ) {
      return true;
    }

    pendingHorizontalWheelDeltaRef.current += deltaX;
    if (
      Math.abs(pendingHorizontalWheelDeltaRef.current) <
      HORIZONTAL_WHEEL_THRESHOLD_PX
    ) {
      return true;
    }

    const now = Date.now();
    if (
      now - lastHorizontalWheelNavigationAtRef.current <
      HORIZONTAL_WHEEL_NAVIGATION_INTERVAL_MS
    ) {
      return true;
    }

    const directionDelta = pendingHorizontalWheelDeltaRef.current;
    pendingHorizontalWheelDeltaRef.current = 0;
    lastHorizontalWheelNavigationAtRef.current = now;
    if (directionDelta > 0) {
      goNextBounded();
    } else {
      goPrevBounded();
    }

    return true;
  };

  useEffect(
    () => () => {
      if (ignoreClickTimerRef.current !== null) {
        window.clearTimeout(ignoreClickTimerRef.current);
      }
      if (horizontalWheelGestureTimerRef.current !== null) {
        window.clearTimeout(horizontalWheelGestureTimerRef.current);
      }
    },
    [],
  );

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
    navigationDirection,
    activeImage,
    canNavigate,
    canGoPrev,
    canGoNext,
    rootRef,
    activeThumbRef,
    thumbStripRef,
    thumbPlacement,
    isPreloaded: true,
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
    goNextBounded,
    goPrevBounded,
    beginHorizontalSwipe,
    endHorizontalSwipe,
    cancelHorizontalSwipe,
    consumeSwipeClick,
    handleHorizontalWheel,
    resetInteractiveState,
  };
}
