"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { getCachedImageUrl } from "@/lib/image-cache";
import Image from "next/image";
import { getBlurDataURL } from "@/lib/image-blur";

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
}: {
  images: string[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  const safeImages = images.filter(Boolean);
  const hasImages = safeImages.length > 0;
  const activeImage = hasImages ? safeImages[activeIndex] : "";
  const cachedActiveImage = activeImage ? getCachedImageUrl(activeImage) : "";
  const blurDataURL = getBlurDataURL(32, 32);
  const canNavigate = safeImages.length > 1;

  const goNext = () => {
    if (!canNavigate) {
      return;
    }
    setActiveIndex((prev) => (prev + 1) % safeImages.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const goPrev = () => {
    if (!canNavigate) {
      return;
    }
    setActiveIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(3, Math.max(1, prev + delta)));
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

  return (
    <div className="grid gap-3">
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 720px"
            className="object-cover"
            priority={false}
            placeholder="blur"
            blurDataURL={blurDataURL}
          />
        ) : (
          placeholder
        )}
      </button>

      {hasImages ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {safeImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className={cn(
                "h-16 w-20 flex-shrink-0 overflow-hidden rounded-2xl border",
                index === activeIndex ? "border-strong" : "border-border",
              )}
              onClick={() => setActiveIndex(index)}
              aria-label={`이미지 ${index + 1}`}
            >
              <Image
                src={getCachedImageUrl(image)}
                alt=""
                width={80}
                height={64}
                className="h-full w-full object-cover"
                sizes="80px"
                placeholder="blur"
                blurDataURL={blurDataURL}
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
            className="h-full w-full overflow-hidden p-6"
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
              const touch = event.touches[0];
              if (touch) {
                handlePanStart(touch.clientX, touch.clientY);
              }
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (touch) {
                handlePanMove(touch.clientX, touch.clientY);
              }
            }}
            onTouchEnd={handlePanEnd}
          >
            <div className="mx-auto flex h-full w-full items-center justify-center">
              {cachedActiveImage ? (
                <img
                  src={cachedActiveImage}
                  alt={name}
                  className="max-h-none max-w-none"
                  style={{
                    touchAction: "none",
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transition: "transform 120ms ease-out",
                  }}
                  loading="lazy"
                />
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
