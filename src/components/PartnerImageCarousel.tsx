"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import TabletImageCarousel from "@/components/partner-image-carousel/TabletImageCarousel";
import ThumbStrip from "@/components/partner-image-carousel/ThumbStrip";
import { useCarouselController } from "@/components/partner-image-carousel/useCarouselController";
import CarouselSlideIndicators from "@/components/ui/CarouselSlideIndicators";
import { isProxiedCachedImageUrl } from "@/lib/image-cache";

const LightboxModal = dynamic(
  () => import("@/components/partner-image-carousel/LightboxModal"),
  { ssr: false },
);

const placeholder = (
  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
    <svg
      width={36}
      height={36}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 16l4-4 4 4 4-4 5 5" />
      <circle cx="9" cy="9" r="2" />
    </svg>
  </div>
);

export default function PartnerImageCarousel({
  images,
  name,
  className,
  matchHeightSelector,
  priority = false,
  variant = "default",
  imageFit = "cover",
  showThumbnails = true,
  mobileFullBleed = false,
  hideThumbnailsOnMobile = false,
  tabletCarouselFrom = "md",
}: {
  images: string[];
  name: string;
  className?: string;
  matchHeightSelector?: string;
  priority?: boolean;
  variant?: "default" | "main" | "hero";
  imageFit?: "cover" | "contain";
  showThumbnails?: boolean;
  mobileFullBleed?: boolean;
  hideThumbnailsOnMobile?: boolean;
  tabletCarouselFrom?: "sm" | "md";
}) {
  const requestedThumbPlacement = "bottom";
  const stageRef = useRef<HTMLDivElement | null>(null);
  const {
    cachedImages,
    hasImages,
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
  } = useCarouselController({
    images,
    matchHeightSelector,
    thumbPlacement: requestedThumbPlacement,
  });
  const imageAspectClassName = variant === "hero" ? "aspect-square" : "aspect-[4/3]";
  const showTabletCarousel = variant === "main" && hasImages && showThumbnails;
  const shouldRenderThumbStrip =
    hasImages &&
    showThumbnails &&
    !(
      showTabletCarousel &&
      tabletCarouselFrom === "sm" &&
      hideThumbnailsOnMobile
    );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (handleHorizontalWheel(event.deltaX, event.deltaY)) {
        event.preventDefault();
      }
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
    };
  }, [handleHorizontalWheel]);

  return (
    <div
      ref={rootRef}
      data-partner-image-carousel={variant}
      className={cn("relative min-w-0", className)}
    >
      {showTabletCarousel ? (
        <TabletImageCarousel
          images={cachedImages}
          name={name}
          activeIndex={activeIndex}
          navigationDirection={navigationDirection}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onSelect={activateImage}
          onOpen={() => setOpen(true)}
          onPrev={goPrevBounded}
          onNext={goNextBounded}
          onSwipeStart={beginHorizontalSwipe}
          onSwipeEnd={endHorizontalSwipe}
          onSwipeCancel={cancelHorizontalSwipe}
          shouldIgnoreSwipeClick={consumeSwipeClick}
          onHorizontalWheel={handleHorizontalWheel}
          visibleFrom={tabletCarouselFrom}
          imageFit={imageFit}
          mobileFullBleed={mobileFullBleed}
          priority={priority}
        />
      ) : null}

      {!showTabletCarousel ? (
        <div
          ref={stageRef}
          data-partner-image-carousel-stage
          className="grid min-w-0 items-start gap-3 overscroll-x-none xl:grid-cols-1 xl:items-start"
        >
          <div className="relative min-w-0">
            <button
              type="button"
              data-partner-image-main-frame
              className={cn(
                "relative w-full overflow-hidden border border-border bg-surface-muted",
                mobileFullBleed ? "rounded-none sm:rounded-3xl" : "rounded-3xl",
                imageAspectClassName,
                "touch-pan-y",
              )}
              onPointerDown={(event) => beginHorizontalSwipe(event.clientX)}
              onPointerUp={(event) => endHorizontalSwipe(event.clientX)}
              onPointerCancel={cancelHorizontalSwipe}
              onClick={() => {
                if (consumeSwipeClick()) {
                  return;
                }
                if (hasImages) {
                  setOpen(true);
                }
              }}
              aria-label={`${name} 이미지 크게 보기`}
            >
              {hasImages ? (
                <Image
                  src={activeImage}
                  alt={name}
                  fill
                  sizes="(max-width: 1279px) 100vw, 50vw"
                  className={
                    imageFit === "contain" ? "object-contain" : "object-cover"
                  }
                  fetchPriority={priority ? "high" : undefined}
                  loading="eager"
                  priority={priority}
                  unoptimized={isProxiedCachedImageUrl(activeImage)}
                />
              ) : (
                placeholder
              )}
            </button>

            {mobileFullBleed && cachedImages.length > 1 ? (
              <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-4 sm:hidden">
                <div className="rounded-full border border-white/25 bg-black/35 px-3 py-1 shadow-flat backdrop-blur-md">
                  <CarouselSlideIndicators
                    labels={cachedImages.map(
                      (_, index) => `${name} 이미지 ${index + 1} 선택`,
                    )}
                    activeIndex={activeIndex}
                    onSelect={activateImage}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {shouldRenderThumbStrip ? (
        <div
          className={cn(
            "min-w-0",
            showTabletCarousel && tabletCarouselFrom === "sm"
              ? "sm:hidden"
              : showTabletCarousel
                ? hideThumbnailsOnMobile
                  ? "hidden sm:block md:hidden"
                  : "md:hidden"
                : hideThumbnailsOnMobile
                  ? "hidden sm:block"
                  : undefined,
          )}
        >
          <ThumbStrip
            images={cachedImages}
            activeIndex={activeIndex}
            placement={thumbPlacement}
            activeThumbRef={activeThumbRef}
            thumbStripRef={thumbStripRef}
            onSelect={activateImage}
          />
        </div>
      ) : null}

      {isOpen ? (
        <LightboxModal
          open={isOpen}
          canNavigate={canNavigate}
          activeImage={activeImage}
          name={name}
          zoom={zoom}
          offset={offset}
          onClose={() => {
            resetInteractiveState();
            setOpen(false);
          }}
          onPrev={goPrev}
          onNext={goNext}
          onZoomChange={handleZoom}
          onOffsetChange={setOffset}
          onPanStart={handlePanStart}
          onPanMove={handlePanMove}
          onPanEnd={handlePanEnd}
          fallback={placeholder}
        />
      ) : null}
    </div>
  );
}
