"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

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

  const safeImages = images.filter(Boolean);
  const hasImages = safeImages.length > 0;
  const activeImage = hasImages ? safeImages[activeIndex] : "";

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
          <img
            src={activeImage}
            alt={name}
            className="h-full w-full object-cover"
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
              <img
                src={image}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <button
            type="button"
            className="absolute right-6 top-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
            onClick={() => setOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
          <div className="h-full w-full overflow-auto p-6">
            <div className="mx-auto flex h-full w-full items-center justify-center">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={name}
                  className="max-h-none max-w-none"
                  style={{ touchAction: "pinch-zoom" }}
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
