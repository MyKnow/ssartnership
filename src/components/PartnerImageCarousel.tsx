"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { cn } from "@/lib/cn";
import ThumbStrip from "@/components/partner-image-carousel/ThumbStrip";
import { useCarouselController } from "@/components/partner-image-carousel/useCarouselController";
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
  showThumbnails = true,
}: {
  images: string[];
  name: string;
  className?: string;
  matchHeightSelector?: string;
  priority?: boolean;
  variant?: "default" | "hero";
  showThumbnails?: boolean;
}) {
  const {
    cachedImages,
    hasImages,
    activeIndex,
    activeImage,
    canNavigate,
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
    resetInteractiveState,
  } = useCarouselController({
    images,
    matchHeightSelector,
  });

  return (
    <div
      ref={rootRef}
      className={cn(
        "grid items-start gap-3",
        variant === "hero" && "h-full md:items-stretch",
        showThumbnails && thumbPlacement === "side"
          ? "xl:grid-cols-[minmax(0,1fr)_7.5rem] xl:items-start"
          : "xl:grid-cols-1 xl:items-start",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-border bg-surface-muted",
          variant === "hero"
            ? "aspect-[4/3] min-h-[16rem] sm:min-h-[20rem] md:h-full md:min-h-0 md:aspect-auto"
            : "aspect-[4/3]",
        )}
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
            fetchPriority={priority ? "high" : undefined}
            loading={priority ? undefined : "eager"}
            priority={priority}
            unoptimized={isProxiedCachedImageUrl(activeImage)}
          />
        ) : (
          placeholder
        )}
      </button>

      {hasImages && showThumbnails ? (
        <ThumbStrip
          images={cachedImages}
          activeIndex={activeIndex}
          placement={thumbPlacement}
          activeThumbRef={activeThumbRef}
          thumbStripRef={thumbStripRef}
          onSelect={activateImage}
        />
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
