"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useEffect, useRef, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { isProxiedCachedImageUrl } from "@/lib/image-cache";

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
  onSelect,
  shouldIgnoreClick,
}: {
  image: string;
  index: number;
  name: string;
  position: "previous" | "next";
  depth: number;
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
          "pointer-events-none absolute top-1/2 aspect-[4/3] -translate-y-1/2 overflow-hidden rounded-card border border-border bg-surface-muted shadow-flat",
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
          sizes="(min-width: 768px) 46vw, 100vw"
          className="scale-[1.04] object-cover blur-[1.5px] saturate-75"
          unoptimized={isProxiedCachedImageUrl(image)}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-surface/10 via-background/30 to-surface/45 backdrop-blur-[1px]"
        />
      </div>
      <button
        type="button"
        className="absolute top-1/2 z-20 -translate-y-1/2 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
}) {
  const carouselSurfaceRef = useRef<HTMLDivElement | null>(null);
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
      className="hidden min-w-0 md:block"
    >
      <div
        ref={carouselSurfaceRef}
        className="relative isolate flex min-w-0 items-center justify-center overflow-hidden py-4 touch-pan-y overscroll-x-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={onSwipeCancel}
      >
        {previousPreviews.map(({ image, index, depth }) => (
          <PreviewCard
            image={image}
            index={index}
            name={name}
            position="previous"
            depth={depth}
            onSelect={onSelect}
            shouldIgnoreClick={shouldIgnoreSwipeClick}
            key={`previous-${image}-${index}`}
          />
        ))}

        <button
          key={activeIndex}
          type="button"
          data-partner-image-carousel-active
          className="relative z-10 aspect-[4/3] w-[65%] overflow-hidden rounded-card border border-primary bg-surface-muted shadow-flat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
              sizes="(min-width: 768px) 65vw, 100vw"
              className="object-cover"
              unoptimized={isProxiedCachedImageUrl(activeImage)}
              priority={activeIndex < 2}
            />
          </span>
        </button>

        {nextPreviews.map(({ image, index, depth }) => (
          <PreviewCard
            image={image}
            index={index}
            name={name}
            position="next"
            depth={depth}
            onSelect={onSelect}
            shouldIgnoreClick={shouldIgnoreSwipeClick}
            key={`next-${image}-${index}`}
          />
        ))}

        {canGoPrev ? (
          <button
            type="button"
            onClick={onPrev}
            aria-label="이전 이미지"
            className="absolute inset-y-0 left-0 z-20 my-auto hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-flat backdrop-blur transition-interactive hover:border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:inline-flex"
          >
            <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
        {canGoNext ? (
          <button
            type="button"
            onClick={onNext}
            aria-label="다음 이미지"
            className="absolute inset-y-0 right-0 z-20 my-auto hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-flat backdrop-blur transition-interactive hover:border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:inline-flex"
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
