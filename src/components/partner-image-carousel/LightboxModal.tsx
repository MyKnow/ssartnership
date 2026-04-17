import { useRef, type ReactNode } from "react";
import Image from "next/image";
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
}) {
  const pinchRef = useRef({
    distance: 0,
    zoom,
    offset: { ...offset },
  });
  const mouseDraggingRef = useRef(false);
  const lastTapRef = useRef(0);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <button
        type="button"
        className="absolute right-6 top-6 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
        onClick={onClose}
        aria-label="닫기"
      >
        ✕
      </button>
      {canNavigate ? (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
            onClick={onPrev}
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
            onClick={onNext}
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
            fallback
          )}
        </div>
      </div>
    </div>
  );
}
