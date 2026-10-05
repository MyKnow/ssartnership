import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { CarouselOffset } from "./types";
import { clampCarouselZoom, getTouchDistance } from "./helpers";

export default function LightboxModal({
  open,
  canNavigate,
  activeImage,
  name,
  zoom,
  offset,
  onClose,
  onPrev,
  onNext,
  onZoomChange,
  onOffsetChange,
  onPanStart,
  onPanMove,
  onPanEnd,
  fallback,
  navigationUnit = "사진",
}: {
  open: boolean;
  canNavigate: boolean;
  activeImage: string;
  name: string;
  zoom: number;
  offset: CarouselOffset;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomChange: (value: number | ((prev: number) => number)) => void;
  onOffsetChange: (value: CarouselOffset) => void;
  onPanStart: (x: number, y: number) => void;
  onPanMove: (x: number, y: number) => void;
  onPanEnd: () => void;
  fallback: ReactNode;
  navigationUnit?: "사진" | "페이지";
}) {
  const pinchRef = useRef({
    distance: 0,
    zoom,
    offset: { ...offset },
  });
  const mouseDraggingRef = useRef(false);
  const lastTapRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape·Tab 순환·초기 포커스·opener 복원은 공용 다이얼로그 계약을 따른다.
  useDialogFocus({ open, containerRef: dialogRef, onClose });

  useEffect(() => {
    if (!open || !canNavigate) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        onPrev();
      } else if (event.key === "ArrowRight") {
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canNavigate, onNext, onPrev, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 focus:outline-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      tabIndex={-1}
    >
      <button
        type="button"
        className="absolute right-6 top-6 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
        onClick={onClose}
        aria-label="닫기"
      >
        ✕
      </button>
      {canNavigate ? (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
            onClick={onPrev}
            aria-label={`이전 ${navigationUnit}`}
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
            className="absolute right-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
            onClick={onNext}
            aria-label={`다음 ${navigationUnit}`}
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
            onZoomChange((prev) => prev - 0.1);
          } else if (event.deltaY < 0) {
            onZoomChange((prev) => prev + 0.1);
          }
        }}
        onDoubleClick={() => {
          onZoomChange((prev) => (prev > 1 ? 1 : 2));
          onOffsetChange({ x: 0, y: 0 });
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          mouseDraggingRef.current = true;
          onPanStart(event.clientX, event.clientY);
        }}
        onMouseMove={(event) => {
          if (!mouseDraggingRef.current) {
            return;
          }
          onPanMove(event.clientX, event.clientY);
        }}
        onMouseUp={() => {
          mouseDraggingRef.current = false;
          onPanEnd();
        }}
        onMouseLeave={() => {
          mouseDraggingRef.current = false;
          onPanEnd();
        }}
        onTouchStart={(event) => {
          event.preventDefault();
          if (event.touches.length === 2) {
            const [a, b] = Array.from(event.touches);
            pinchRef.current.distance = getTouchDistance(a, b);
            pinchRef.current.zoom = zoom;
            pinchRef.current.offset = { ...offset };
            return;
          }
          const touch = event.touches[0];
          if (touch) {
            onPanStart(touch.clientX, touch.clientY);
          }
        }}
        onTouchMove={(event) => {
          event.preventDefault();
          if (event.touches.length === 2) {
            const [a, b] = Array.from(event.touches);
            const distance = getTouchDistance(a, b);
            if (pinchRef.current.distance === 0) {
              return;
            }
            const scale = distance / pinchRef.current.distance;
            onZoomChange(clampCarouselZoom(pinchRef.current.zoom * scale));
            onOffsetChange(pinchRef.current.offset);
            return;
          }
          const touch = event.touches[0];
          if (touch) {
            onPanMove(touch.clientX, touch.clientY);
          }
        }}
        onTouchEnd={(event) => {
          onPanEnd();
          if (event.touches.length === 0) {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              onZoomChange((prev) => (prev > 1 ? 1 : 2));
              onOffsetChange({ x: 0, y: 0 });
              lastTapRef.current = 0;
              return;
            }
            lastTapRef.current = now;
          }
        }}
      >
        <div className="mx-auto flex h-full w-full items-center justify-center">
          {activeImage ? (
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
                src={activeImage}
                alt={name}
                fill
                sizes="100vw"
                className="object-contain"
                unoptimized
                loading="eager"
              />
            </div>
          ) : (
            <div className="text-white">{fallback}</div>
          )}
        </div>
      </div>
    </div>
  );
}
