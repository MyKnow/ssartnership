"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import {
  getCachedImageUrl,
  isCachedImageUrlPreloaded,
  preloadCachedImageUrls,
} from "@/lib/image-cache";
import Skeleton from "@/components/ui/Skeleton";

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

function CarouselLoadingSkeleton({
  className,
  imageCount,
  style,
}: {
  className?: string;
  imageCount: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 xl:grid-cols-[minmax(0,1fr)_7.5rem] xl:items-stretch",
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-surface-muted">
        <Skeleton className="h-full w-full rounded-none" />
      </div>

      <div className="flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2 xl:h-full xl:min-h-0 xl:flex-col xl:items-center xl:gap-3 xl:overflow-y-auto xl:overflow-x-visible xl:px-3 xl:py-2">
        {Array.from({ length: Math.max(1, imageCount) }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-16 w-20 flex-shrink-0 rounded-2xl xl:h-20 xl:w-20"
          />
        ))}
      </div>
    </div>
  );
}

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef({
    distance: 0,
    zoom: 1,
    center: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
  });
  const lastTapRef = useRef(0);

  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const cachedImages = useMemo(
    () => safeImages.map((image) => getCachedImageUrl(image)),
    [safeImages],
  );
  const hasImages = cachedImages.length > 0;
  const imageCount = cachedImages.length;
  const activeImage = hasImages ? cachedImages[activeIndex] : "";
  const cachedActiveImage = activeImage ?? "";
  const canNavigate = imageCount > 1;
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const thumbStripRef = useRef<HTMLDivElement | null>(null);
  const [desktopHeight, setDesktopHeight] = useState<number | null>(null);
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
  }, [activeIndex, hasImages, imageCount, isOpen, isPreloaded]);

  useEffect(() => {
    const thumb = activeThumbRef.current;
    const strip = thumbStripRef.current;
    if (!thumb || !strip) {
      return;
    }

    const isDesktop = window.matchMedia(
      "(min-width: 1280px) and (pointer: fine)",
    ).matches;
    if (isDesktop) {
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
  }, [activeIndex]);

  useEffect(() => {
    if (!matchHeightSelector || typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(min-width: 1280px)");
    let observer: ResizeObserver | null = null;

    const syncHeight = () => {
      if (!media.matches) {
        setDesktopHeight(null);
        return;
      }
      const target = document.querySelector(matchHeightSelector);
      if (!(target instanceof HTMLElement)) {
        setDesktopHeight(null);
        return;
      }
      setDesktopHeight(target.getBoundingClientRect().height);
    };

    const target = document.querySelector(matchHeightSelector);
    if (target instanceof HTMLElement) {
      observer = new ResizeObserver(() => {
        syncHeight();
      });
      observer.observe(target);
    }

    syncHeight();
    media.addEventListener("change", syncHeight);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer?.disconnect();
      media.removeEventListener("change", syncHeight);
      window.removeEventListener("resize", syncHeight);
    };
  }, [matchHeightSelector]);

  const activateImage = (nextIndex: number) => {
    if (!canNavigate) {
      return;
    }
    const normalizedIndex = (nextIndex + imageCount) % imageCount;
    setActiveIndex(normalizedIndex);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const goNext = () => {
    activateImage(activeIndex + 1);
  };

  const goPrev = () => {
    activateImage(activeIndex - 1);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(4, Math.max(1, prev + delta)));
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

  const clampZoom = (value: number) => Math.min(4, Math.max(1, value));

  const getDistance = (
    a: { clientX: number; clientY: number },
    b: { clientX: number; clientY: number },
  ) => {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  };

  if (hasImages && !isPreloaded) {
    return (
      <CarouselLoadingSkeleton
        className={className}
        imageCount={imageCount}
        style={desktopHeight ? { height: `${desktopHeight}px` } : undefined}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 xl:grid-cols-[minmax(0,1fr)_7.5rem] xl:items-stretch",
        className,
      )}
      style={desktopHeight ? { height: `${desktopHeight}px` } : undefined}
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
            src={cachedActiveImage}
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
        <div
          ref={thumbStripRef}
          className="flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2 xl:h-full xl:min-h-0 xl:flex-col xl:items-center xl:gap-3 xl:overflow-y-auto xl:overflow-x-visible xl:px-3 xl:py-2"
        >
          {safeImages.map((image, index) => (
            <button
              ref={index === activeIndex ? activeThumbRef : null}
              key={`${image}-${index}`}
              type="button"
              className={cn(
                "relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 ease-out xl:h-20 xl:w-20",
                index === activeIndex
                  ? "z-10 scale-[1.04] border-strong ring-2 ring-inset ring-strong/80 shadow-[0_4px_10px_rgba(0,0,0,0.48)] dark:shadow-[0_4px_10px_rgba(255,255,255,0.24)] xl:scale-[1.08]"
                  : "border-border hover:border-strong/70",
              )}
              onClick={() => activateImage(index)}
              aria-pressed={index === activeIndex}
              aria-label={`이미지 ${index + 1}`}
            >
              <Image
                src={cachedImages[index]}
                alt=""
                width={80}
                height={64}
                className="h-full w-full object-cover"
                sizes="80px"
                unoptimized
                loading="eager"
              />
            </button>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <button
            type="button"
            className="absolute right-6 top-6 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
              setOpen(false);
            }}
            aria-label="닫기"
          >
            ✕
          </button>
          {canNavigate ? (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
                onClick={goPrev}
                aria-label="이전 사진"
              >
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
                onClick={goNext}
                aria-label="다음 사진"
              >
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          ) : null}
          <div
            className="h-full w-full overflow-hidden p-6 touch-none overscroll-contain"
            onWheel={(event) => {
              if (event.deltaY > 0) {
                handleZoom(-0.1);
              } else if (event.deltaY < 0) {
                handleZoom(0.1);
              }
            }}
            onDoubleClick={() => {
              setZoom((prev) => (prev > 1 ? 1 : 2));
              setOffset({ x: 0, y: 0 });
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              handlePanStart(event.clientX, event.clientY);
            }}
            onMouseMove={(event) => {
              handlePanMove(event.clientX, event.clientY);
            }}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onTouchStart={(event) => {
              event.preventDefault();
              if (event.touches.length === 2) {
                const [a, b] = Array.from(event.touches);
                pinchRef.current.distance = getDistance(a, b);
                pinchRef.current.zoom = zoom;
                pinchRef.current.center = {
                  x: (a.clientX + b.clientX) / 2,
                  y: (a.clientY + b.clientY) / 2,
                };
                pinchRef.current.offset = { ...offset };
                isPanningRef.current = false;
                return;
              }
              const touch = event.touches[0];
              if (touch) {
                handlePanStart(touch.clientX, touch.clientY);
              }
            }}
            onTouchMove={(event) => {
              event.preventDefault();
              if (event.touches.length === 2) {
                const [a, b] = Array.from(event.touches);
                const distance = getDistance(a, b);
                if (pinchRef.current.distance === 0) {
                  return;
                }
                const scale = distance / pinchRef.current.distance;
                const nextZoom = clampZoom(pinchRef.current.zoom * scale);
                setZoom(nextZoom);
                setOffset(pinchRef.current.offset);
                return;
              }
              const touch = event.touches[0];
              if (touch) {
                handlePanMove(touch.clientX, touch.clientY);
              }
            }}
            onTouchEnd={(event) => {
              handlePanEnd();
              if (event.touches.length === 0) {
                const now = Date.now();
                if (now - lastTapRef.current < 300) {
                  setZoom((prev) => (prev > 1 ? 1 : 2));
                  setOffset({ x: 0, y: 0 });
                  lastTapRef.current = 0;
                  return;
                }
                lastTapRef.current = now;
              }
            }}
          >
            <div className="mx-auto flex h-full w-full items-center justify-center">
              {cachedActiveImage ? (
                <div
                  className="relative"
                  style={{
                    width: "min(92vw, 1100px)",
                    height: "min(80vh, 760px)",
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transition: "transform 120ms ease-out",
                    touchAction: "none",
                  }}
                >
                  <Image
                    src={cachedActiveImage}
                    alt={name}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    unoptimized
                    loading="eager"
                  />
                </div>
              ) : (
                placeholder
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
