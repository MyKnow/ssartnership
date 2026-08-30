"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import CarouselSlideIndicators from "@/components/ui/CarouselSlideIndicators";

type HorizontalSwipeHandler = (clientX: number) => void;
type HorizontalWheelHandler = (deltaX: number, deltaY: number) => boolean;
const ACTIVE_WIDTH_PERCENT = 65;
const ACTIVE_EDGE_PERCENT = (100 - ACTIVE_WIDTH_PERCENT) / 2;

function PreviewCard({
  image,
  index,
  name,
  position,
  depth,
  visibleFrom,
  onSelect,
  shouldIgnoreClick,
}: {
  image: string;
  index: number;
  name: string;
  position: "previous" | "next";
  depth: number;
  visibleFrom: "sm" | "md";
  onSelect: (index: number) => void;
  shouldIgnoreClick: () => boolean;
}) {
  const widthPercent = Math.max(29, 45.5 - (depth - 1) * 7.5);
  const insetPercent = Math.max(0, 7 - (depth - 1) * 4.5);
  const previousInsetPercent =
    depth === 1 ? ACTIVE_EDGE_PERCENT : Math.max(0, 7 - (depth - 2) * 4.5);
  const exposedWidthPercent = previousInsetPercent - insetPercent;

  return (
    <>
      <div
        aria-hidden="true"
        data-partner-image-carousel-preview={position}
        className={cn(
          "pointer-events-none absolute top-1/2 hidden aspect-[4/3] -translate-y-1/2 overflow-hidden rounded-card border border-border bg-surface-muted shadow-flat",
          visibleFrom === "sm" ? "sm:block" : "md:block",
        )}
        style={{
          width: `${widthPercent}%`,
          [position === "previous" ? "left" : "right"]: `${insetPercent}%`,
          zIndex: 10 - depth,
          opacity: Math.max(0.42, 1 - (depth - 1) * 0.18),
        }}
      >
        <Image
          src={image}
          alt=""
          fill
          sizes={
            visibleFrom === "sm"
              ? "(min-width: 640px) 46vw, 100vw"
              : "(min-width: 768px) 46vw, 100vw"
          }
          className="scale-[1.04] object-cover blur-[1.5px] saturate-75"
          loading={depth === 1 ? "eager" : "lazy"}
          fetchPriority={depth === 1 ? "auto" : "low"}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-surface/10 via-background/30 to-surface/45 backdrop-blur-[1px]"
        />
      </div>
      <button
        type="button"
        className={cn(
          "absolute top-1/2 z-20 hidden -translate-y-1/2 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          visibleFrom === "sm" ? "sm:block" : "md:block",
        )}
        style={{
          width: `${exposedWidthPercent}%`,
          height: `${(widthPercent / ACTIVE_WIDTH_PERCENT) * 100}%`,
          [position === "previous" ? "left" : "right"]: `${insetPercent}%`,
        }}
        onClick={() => {
          if (!shouldIgnoreClick()) {
            onSelect(index);
          }
        }}
        aria-label={`${name} 이미지 ${index + 1} 선택`}
      />
    </>
  );
}

export default function TabletImageCarousel({
  images,
  name,
  activeIndex,
  navigationDirection,
  canGoPrev,
  canGoNext,
  onSelect,
  onOpen,
  onPrev,
  onNext,
  onSwipeStart,
  onSwipeEnd,
  onSwipeCancel,
  shouldIgnoreSwipeClick,
  onHorizontalWheel,
  visibleFrom = "md",
  imageFit = "cover",
  mobileFullBleed = false,
  priority = false,
}: {
  images: string[];
  name: string;
  activeIndex: number;
  navigationDirection: "next" | "previous";
  canGoPrev: boolean;
  canGoNext: boolean;
  onSelect: (index: number) => void;
  onOpen: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSwipeStart: HorizontalSwipeHandler;
  onSwipeEnd: HorizontalSwipeHandler;
  onSwipeCancel: () => void;
  shouldIgnoreSwipeClick: () => boolean;
  onHorizontalWheel: HorizontalWheelHandler;
  visibleFrom?: "sm" | "md";
  imageFit?: "cover" | "contain";
  mobileFullBleed?: boolean;
  priority?: boolean;
}) {
  const carouselSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [isExpandedCarousel, setIsExpandedCarousel] = useState(false);
  const activeImage = images[activeIndex];
  const firstPreviousIndex = Math.max(0, activeIndex - 3);
  const previousPreviews = images
    .slice(firstPreviousIndex, activeIndex)
    .map((image, offset) => ({ image, index: firstPreviousIndex + offset }))
    .reverse()
    .map((preview, offset) => ({ ...preview, depth: offset + 1 }));
  const nextPreviews = images
    .slice(activeIndex + 1, activeIndex + 4)
    .map((image, offset) => ({
      image,
      index: activeIndex + offset + 1,
      depth: offset + 1,
    }));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onSwipeStart(event.clientX);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    onSwipeEnd(event.clientX);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      visibleFrom === "sm" ? "(min-width: 640px)" : "(min-width: 768px)",
    );
    const updateExpandedCarousel = () => {
      setIsExpandedCarousel(mediaQuery.matches);
    };

    updateExpandedCarousel();
    mediaQuery.addEventListener("change", updateExpandedCarousel);
    return () => {
      mediaQuery.removeEventListener("change", updateExpandedCarousel);
    };
  }, [visibleFrom]);

  useEffect(() => {
    const surface = carouselSurfaceRef.current;
    if (!surface) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (onHorizontalWheel(event.deltaX, event.deltaY)) {
        event.preventDefault();
      }
    };

    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      surface.removeEventListener("wheel", handleWheel);
    };
  }, [onHorizontalWheel]);

  if (!activeImage) {
    return null;
  }

  return (
    <section
      aria-label={`${name} 이미지`}
      data-partner-image-tablet-carousel
      data-partner-image-carousel-expanded={isExpandedCarousel}
      className="min-w-0"
    >
      <div
        ref={carouselSurfaceRef}
        className={cn(
          "relative isolate flex min-w-0 items-center justify-center overflow-hidden p-0 touch-pan-y overscroll-x-none",
          visibleFrom === "sm" ? "sm:py-4" : "md:py-4",
        )}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={onSwipeCancel}
      >
        {isExpandedCarousel
          ? previousPreviews.map(({ image, index, depth }) => (
              <PreviewCard
                image={image}
                index={index}
                name={name}
                position="previous"
                depth={depth}
                visibleFrom={visibleFrom}
                onSelect={onSelect}
                shouldIgnoreClick={shouldIgnoreSwipeClick}
                key={`previous-${image}-${index}`}
              />
            ))
          : null}

        <button
          key={activeIndex}
          type="button"
          data-partner-image-main-frame
          data-partner-image-carousel-active
          className={cn(
            "relative z-10 aspect-[4/3] w-full overflow-hidden border border-border bg-surface-muted shadow-flat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            mobileFullBleed ? "rounded-none" : "rounded-3xl",
            visibleFrom === "sm"
              ? "sm:w-[65%] sm:rounded-card sm:border-primary"
              : "md:w-[65%] md:rounded-card md:border-primary",
          )}
          onClick={() => {
            if (!shouldIgnoreSwipeClick()) {
              onOpen();
            }
          }}
          aria-label={`이미지 ${activeIndex + 1} 크게 보기`}
        >
          <span
            className={cn(
              "absolute inset-0 motion-reduce:animate-none",
              navigationDirection === "next"
                ? "motion-safe:animate-[partner-image-carousel-enter-next_320ms_var(--ease-standard)_both]"
                : "motion-safe:animate-[partner-image-carousel-enter-previous_320ms_var(--ease-standard)_both]",
            )}
          >
            <Image
              src={activeImage}
              alt={name}
              fill
              sizes={
                visibleFrom === "sm"
                  ? "(max-width: 639px) 100vw, 65vw"
                  : "(max-width: 767px) 100vw, 65vw"
              }
              className={imageFit === "contain" ? "object-contain" : "object-cover"}
              loading="eager"
              fetchPriority={priority ? "high" : undefined}
              priority={priority}
            />
          </span>
        </button>

        {!isExpandedCarousel && mobileFullBleed && images.length > 1 ? (
          <div
            className={cn(
              "absolute inset-x-0 bottom-3 z-20 flex justify-center px-4",
              visibleFrom === "sm" ? "sm:hidden" : "md:hidden",
            )}
          >
            <div className="rounded-full border border-white/25 bg-black/35 px-3 py-1 shadow-flat backdrop-blur-md">
              <CarouselSlideIndicators
                labels={images.map(
                  (_, index) => `${name} 이미지 ${index + 1} 선택`,
                )}
                activeIndex={activeIndex}
                onSelect={onSelect}
              />
            </div>
          </div>
        ) : null}

        {isExpandedCarousel
          ? nextPreviews.map(({ image, index, depth }) => (
              <PreviewCard
                image={image}
                index={index}
                name={name}
                position="next"
                depth={depth}
                visibleFrom={visibleFrom}
                onSelect={onSelect}
                shouldIgnoreClick={shouldIgnoreSwipeClick}
                key={`next-${image}-${index}`}
              />
            ))
          : null}

        {isExpandedCarousel && canGoPrev ? (
          <button
            type="button"
            onClick={onPrev}
            aria-label="이전 이미지"
            className={cn(
              "absolute inset-y-0 left-0 z-20 my-auto hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-flat backdrop-blur transition-interactive hover:border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              visibleFrom === "sm" ? "sm:inline-flex" : "md:inline-flex",
            )}
          >
            <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
        {isExpandedCarousel && canGoNext ? (
          <button
            type="button"
            onClick={onNext}
            aria-label="다음 이미지"
            className={cn(
              "absolute inset-y-0 right-0 z-20 my-auto hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-flat backdrop-blur transition-interactive hover:border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              visibleFrom === "sm" ? "sm:inline-flex" : "md:inline-flex",
            )}
          >
            <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        현재 이미지 {activeIndex + 1} / {images.length}
      </p>
    </section>
  );
}
