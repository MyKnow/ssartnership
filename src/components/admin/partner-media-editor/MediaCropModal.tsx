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
import { useToast } from "@/components/ui/Toast";
import {
  PARTNER_THUMBNAIL_ASPECT_RATIO,
} from "@/lib/partner-media";
import {
  clamp,
  createWebpFile,
} from "@/components/admin/partner-media-editor/utils";

export default function MediaCropModal({
  open,
  title,
  subtitle,
  aspectRatio,
  sourceUrl,
  outputName,
  onCancel,
  onApply,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  aspectRatio: number;
  sourceUrl: string;
  outputName: string;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const { notify } = useToast();
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
  }, [open, aspectRatio]);

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
      setImageState({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
      imageRef.current = image;
      setError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      const message = "이미지를 불러올 수 없습니다. 다른 파일이나 링크를 사용해 주세요.";
      setError(message);
      notify(message);
      onCancel();
    };
    image.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [notify, onCancel, open, sourceUrl]);

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
      const message = "이미지를 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.";
      setError(message);
      notify(message);
      return;
    }

    setIsExporting(true);

    try {
      const canvas = document.createElement("canvas");
      const outputWidth = aspectRatio === PARTNER_THUMBNAIL_ASPECT_RATIO ? 1200 : 1600;
      const outputHeight = Math.round(outputWidth / aspectRatio);
      canvas.width = outputWidth;
      canvas.height = outputHeight;

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
        outputWidth,
        outputHeight,
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
        nextError instanceof Error && nextError.message
          ? nextError.message
          : "이미지 변환에 실패했습니다.";
      setError(message);
      notify(message);
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="my-auto grid w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] gap-4 overflow-y-auto rounded-[28px] border border-white/10 bg-surface-overlay p-4 shadow-[var(--shadow-overlay)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-base font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} ariaLabel="닫기" title="닫기">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div
            ref={frameRef}
            className="relative min-h-[16rem] overflow-hidden rounded-[24px] border border-border bg-slate-950/90 sm:min-h-[20rem]"
            style={{ aspectRatio }}
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
                {/* eslint-disable-next-line @next/next/no-img-element -- crop modal needs blob/object URL preview */}
                <img
                  src={sourceUrl}
                  alt=""
                  className="h-full w-full select-none object-cover"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/70">
                <span className="text-sm">이미지를 불러오는 중...</span>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 border-2 border-white/70" />
            <div className="pointer-events-none absolute inset-x-4 top-4 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white/80">
              {aspectRatio === PARTNER_THUMBNAIL_ASPECT_RATIO ? "1:1 THUMBNAIL" : "4:3 GALLERY"}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0,transparent_calc(50%-1px),rgba(255,255,255,0.18)_calc(50%-1px),rgba(255,255,255,0.18)_calc(50%+1px),transparent_calc(50%+1px),transparent_100%),linear-gradient(0deg,transparent_0,transparent_calc(50%-1px),rgba(255,255,255,0.18)_calc(50%-1px),rgba(255,255,255,0.18)_calc(50%+1px),transparent_calc(50%+1px),transparent_100%)]" />
          </div>

          <div className="grid gap-4 rounded-[24px] border border-border bg-surface-muted p-4">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-foreground">조정 가이드</p>
              <p className="text-sm leading-6 text-muted-foreground">
                이미지를 드래그해서 위치를 맞추고, 슬라이더로 크기를 조절하세요.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              확대
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="accent-primary"
              />
            </label>
            <div className="grid gap-2 text-xs text-muted-foreground">
              <p>드래그: 위치 이동</p>
              <p>기준 비율: {aspectRatio === PARTNER_THUMBNAIL_ASPECT_RATIO ? "1:1" : "4:3"}</p>
            </div>
            {error ? <FormMessage variant="error">{error}</FormMessage> : null}
            <div className="flex flex-col gap-2">
              <Button onClick={exportFile} disabled={!imageState} loading={isExporting} loadingText="적용 중">
                적용
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                취소
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
