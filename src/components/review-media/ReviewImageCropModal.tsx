"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { REVIEW_IMAGE_ASPECT_RATIO } from "@/lib/review-media";
import { clamp, createWebpFile } from "@/components/review-media/shared";

export default function ReviewImageCropModal({
  open,
  sourceUrl,
  outputName,
  onCancel,
  onApply,
}: {
  open: boolean;
  sourceUrl: string;
  outputName: string;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageState, setImageState] = useState<{
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!open || !frameRef.current) {
      return;
    }

    const frame = frameRef.current;
    const updateSize = () => {
      setFrameSize({
        width: frame.clientWidth,
        height: frame.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) {
        return;
      }
      imageRef.current = image;
      setImageState({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      setError("이미지를 불러올 수 없습니다. 다른 파일을 선택해 주세요.");
    };
    image.src = sourceUrl;

    return () => {
      cancelled = true;
    };
  }, [open, sourceUrl]);

  const fitScale = useMemo(() => {
    if (!imageState || frameSize.width === 0 || frameSize.height === 0) {
      return 1;
    }
    return Math.max(
      frameSize.width / imageState.naturalWidth,
      frameSize.height / imageState.naturalHeight,
    );
  }, [frameSize.height, frameSize.width, imageState]);

  const scaledWidth = imageState ? imageState.naturalWidth * fitScale * zoom : 0;
  const scaledHeight = imageState ? imageState.naturalHeight * fitScale * zoom : 0;
  const maxOffsetX = imageState ? Math.max(0, (scaledWidth - frameSize.width) / 2) : 0;
  const maxOffsetY = imageState ? Math.max(0, (scaledHeight - frameSize.height) / 2) : 0;
  const boundedOffset = {
    x: clamp(offset.x, -maxOffsetX, maxOffsetX),
    y: clamp(offset.y, -maxOffsetY, maxOffsetY),
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageState) {
      return;
    }
    event.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    offsetStartRef.current = { ...boundedOffset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !imageState) {
      return;
    }
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    setOffset({
      x: clamp(offsetStartRef.current.x + deltaX, -maxOffsetX, maxOffsetX),
      y: clamp(offsetStartRef.current.y + deltaY, -maxOffsetY, maxOffsetY),
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const exportFile = async () => {
    if (!imageState || !imageRef.current || frameSize.width === 0 || frameSize.height === 0) {
      setError("이미지를 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setIsExporting(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("이미지 처리에 실패했습니다.");
      }

      const scale = fitScale * zoom;
      const sourceWidth = frameSize.width / scale;
      const sourceHeight = frameSize.height / scale;
      const sourceX =
        imageState.naturalWidth / 2 - (frameSize.width / 2 + boundedOffset.x) / scale;
      const sourceY =
        imageState.naturalHeight / 2 - (frameSize.height / 2 + boundedOffset.y) / scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        imageRef.current,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        1200,
        1200,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (!nextBlob) {
            reject(new Error("이미지 변환에 실패했습니다."));
            return;
          }
          resolve(nextBlob);
        }, "image/webp", 0.78);
      });

      onApply(createWebpFile(blob, outputName));
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "이미지 변환에 실패했습니다.";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="grid w-full max-w-4xl gap-4 rounded-[28px] border border-white/10 bg-surface p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-base font-semibold text-foreground">리뷰 사진 자르기</p>
            <p className="text-sm text-muted-foreground">
              정방형으로 잘라 저장합니다. 저장 시 `webp`로 변환됩니다.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} ariaLabel="닫기" title="닫기">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div
            ref={frameRef}
            className="relative min-h-[16rem] overflow-hidden rounded-[24px] border border-border bg-slate-950/90 select-none touch-none overscroll-contain sm:min-h-[20rem]"
            style={{ aspectRatio: REVIEW_IMAGE_ASPECT_RATIO, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {imageState ? (
              <div
                className="absolute left-1/2 top-1/2 select-none"
                style={{
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  transform: `translate(-50%, -50%) translate(${boundedOffset.x}px, ${boundedOffset.y}px)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourceUrl}
                  alt=""
                  className="h-full w-full pointer-events-none object-cover"
                  draggable={false}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm text-foreground">
              확대
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>

            <div className="rounded-[1.25rem] border border-border bg-surface-muted/70 p-4 text-sm text-muted-foreground">
              드래그해서 구도를 조정하고, 확대 슬라이더로 원하는 구도를 맞춘 뒤 적용하세요.
            </div>

            {error ? <FormMessage variant="error">{error}</FormMessage> : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onCancel}>
                취소
              </Button>
              <Button onClick={exportFile} loading={isExporting} loadingText="변환 중">
                적용
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
