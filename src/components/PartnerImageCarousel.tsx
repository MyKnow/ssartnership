"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import CarouselLoadingSkeleton from "@/components/partner-image-carousel/CarouselLoadingSkeleton";
import LightboxModal from "@/components/partner-image-carousel/LightboxModal";
import ThumbStrip from "@/components/partner-image-carousel/ThumbStrip";
import { useCarouselController } from "@/components/partner-image-carousel/useCarouselController";

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
}: {
  images: string[];
  name: string;
  className?: string;
  matchHeightSelector?: string;
}) {
  const {
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
  } = useCarouselController({
    images,
    matchHeightSelector,
  });

  if (hasImages && !isPreloaded) {
    return (
      <CarouselLoadingSkeleton
        className={className}
        imageCount={imageCount}
        thumbPlacement={thumbPlacement}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "grid gap-3 items-start",
        thumbPlacement === "side"
          ? "xl:grid-cols-[minmax(0,1fr)_7.5rem] xl:items-start"
          : "xl:grid-cols-1 xl:items-start",
        className,
      )}
    >
      <button
        type="button"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-surface-muted"
        onClick={() => {
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
            className="object-cover"
            unoptimized
            loading="eager"
          />
        ) : (
          placeholder
        )}
      </button>

      {hasImages ? (
        <ThumbStrip
          images={cachedImages}
          activeIndex={activeIndex}
          placement={thumbPlacement}
          activeThumbRef={activeThumbRef}
          thumbStripRef={thumbStripRef}
          onSelect={activateImage}
        />
      ) : null}

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
    </div>
  );
}
