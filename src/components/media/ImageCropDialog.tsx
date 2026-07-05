"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

function createImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    image.src = sourceUrl;
  });
}

function createWebpFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

async function exportCroppedImage({
  sourceUrl,
  crop,
  outputName,
  outputWidth,
  outputHeight,
  quality,
}: {
  sourceUrl: string;
  crop: Area;
  outputName: string;
  outputWidth: number;
  outputHeight: number;
  quality: number;
}) {
  const image = await createImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("이미지 처리에 실패했습니다.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("이미지 변환에 실패했습니다."));
          return;
        }
        resolve(nextBlob);
      },
      "image/webp",
      quality,
    );
  });
  return createWebpFile(blob, outputName);
}

async function createCroppedPreview({
  sourceUrl,
  crop,
  aspectRatio,
}: {
  sourceUrl: string;
  crop: Area;
  aspectRatio: number;
}) {
  const image = await createImage(sourceUrl);
  const width = 320;
  const height = Math.max(1, Math.round(width / aspectRatio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );
  return canvas.toDataURL("image/webp", 0.72);
}

function getAspectLabel(aspectRatio: number) {
  if (Math.abs(aspectRatio - 1) < 0.01) {
    return "1:1";
  }
  if (Math.abs(aspectRatio - 4 / 3) < 0.01) {
    return "4:3";
  }
  if (Math.abs(aspectRatio - 21 / 9) < 0.02) {
    return "21:9";
  }
  return `${aspectRatio.toFixed(2)}:1`;
}

export default function ImageCropDialog({
  open,
  title,
  subtitle,
  aspectRatio,
  sourceUrl,
  outputName,
  outputWidth,
  outputHeight,
  quality = 0.78,
  queueCount = 1,
  accept = "image/*",
  validateFile,
  onCancel,
  onApply,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  aspectRatio: number;
  sourceUrl: string;
  outputName: string;
  outputWidth: number;
  outputHeight: number;
  quality?: number;
  queueCount?: number;
  accept?: string;
  validateFile?: (file: File) => string | null;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const { notify } = useToast();
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const replacementInputRef = useRef<HTMLInputElement | null>(null);
  const replacementObjectUrlRef = useRef<string | null>(null);
  const [activeSourceUrl, setActiveSourceUrl] = useState(sourceUrl);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !portalRoot) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (replacementObjectUrlRef.current) {
      URL.revokeObjectURL(replacementObjectUrlRef.current);
      replacementObjectUrlRef.current = null;
    }
    setActiveSourceUrl(sourceUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl(null);
    setError(null);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (replacementObjectUrlRef.current) {
        URL.revokeObjectURL(replacementObjectUrlRef.current);
        replacementObjectUrlRef.current = null;
      }
    };
  }, [open, portalRoot, sourceUrl]);

  useEffect(() => {
    if (!open || !activeSourceUrl || !croppedAreaPixels) {
      setPreviewUrl(null);
      return;
    }

    let canceled = false;
    const timer = window.setTimeout(() => {
      createCroppedPreview({
        sourceUrl: activeSourceUrl,
        crop: croppedAreaPixels,
        aspectRatio,
      })
        .then((nextPreviewUrl) => {
          if (!canceled) {
            setPreviewUrl(nextPreviewUrl);
          }
        })
        .catch(() => {
          if (!canceled) {
            setPreviewUrl(null);
          }
        });
    }, 80);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [activeSourceUrl, aspectRatio, croppedAreaPixels, open]);

  const resetAdjustments = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl(null);
    setError(null);
  };

  const replaceSource = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }

    const validationError = validateFile?.(file) ?? null;
    if (validationError) {
      setError(validationError);
      notify(validationError);
      return;
    }

    if (replacementObjectUrlRef.current) {
      URL.revokeObjectURL(replacementObjectUrlRef.current);
    }
    const nextSourceUrl = URL.createObjectURL(file);
    replacementObjectUrlRef.current = nextSourceUrl;
    setActiveSourceUrl(nextSourceUrl);
    resetAdjustments();
  };

  const exportFile = async () => {
    if (!croppedAreaPixels) {
      const message = "이미지를 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.";
      setError(message);
      notify(message);
      return;
    }
    setIsExporting(true);
    try {
      const file = await exportCroppedImage({
        sourceUrl: activeSourceUrl,
        crop: croppedAreaPixels,
        outputName,
        outputWidth,
        outputHeight,
        quality,
      });
      onApply(file);
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

  if (!open || !portalRoot) {
    return null;
  }

  const aspectLabel = getAspectLabel(aspectRatio);
  const zoomPercent = `${Math.round(zoom * 100)}%`;
  const outputSizeLabel = `${outputWidth.toLocaleString("ko-KR")}x${outputHeight.toLocaleString("ko-KR")}`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-surface-overlay shadow-overlay sm:max-h-[calc(100dvh-3rem)] sm:rounded-[1.75rem]">
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 pt-1">
            <p className="truncate text-base font-semibold text-foreground">{title}</p>
            <p className="line-clamp-1 text-sm leading-5 text-muted-foreground sm:line-clamp-2 sm:leading-6">
              {subtitle}
            </p>
            {queueCount > 1 ? (
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-primary">
                여러 이미지를 순차 처리 중입니다. 남은 이미지 {queueCount}개
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} ariaLabel="닫기" title="닫기">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid min-h-0 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch">
            <div
              className="relative h-[15.5rem] w-full min-w-0 overflow-hidden rounded-[1.35rem] border border-border bg-slate-950/95 sm:h-auto sm:min-h-[24rem] lg:min-h-[32rem]"
              style={{ aspectRatio }}
            >
              <Cropper
                image={activeSourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                minZoom={1}
                maxZoom={4}
                restrictPosition
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                onMediaLoaded={() => setError(null)}
                style={{
                  cropAreaStyle: {
                    border: "2px solid rgba(255,255,255,0.95)",
                    boxShadow:
                      "0 0 0 9999em rgba(2,6,23,0.58), 0 0 0 1px rgba(15,23,42,0.75)",
                  },
                }}
                mediaProps={{
                  onError: () => {
                    setCroppedAreaPixels(null);
                    setPreviewUrl(null);
                    setError("이미지를 불러올 수 없습니다. 다른 파일을 선택해 주세요.");
                  },
                }}
              />
            </div>

            <div className="grid min-h-0 content-start gap-2 rounded-[1.35rem] border border-border bg-surface-muted p-3 sm:gap-3 sm:p-4 lg:overflow-y-auto">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">조정</p>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground sm:line-clamp-2 sm:text-sm sm:leading-6">
                  드래그로 위치를 맞추고 슬라이더로 확대합니다.
                </p>
              </div>

              <div className="hidden min-w-0 gap-2 rounded-[1.1rem] border border-border bg-surface-inset p-2 sm:grid sm:p-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-foreground">결과 미리보기</p>
                  <span className="shrink-0 rounded-full border border-primary/15 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {aspectLabel}
                  </span>
                </div>
                <div
                  className="relative h-24 min-w-0 overflow-hidden rounded-[0.9rem] border border-border bg-surface-muted sm:h-auto"
                  style={{ aspectRatio }}
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview is generated from canvas data URL
                    <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs leading-5 text-muted-foreground">
                      <PhotoIcon className="h-6 w-6" />
                      <span className="line-clamp-2">미리보기를 준비하고 있습니다.</span>
                    </div>
                  )}
                </div>
              </div>

              <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground sm:gap-2">
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="truncate">확대</span>
                  <span className="shrink-0 text-xs font-semibold text-primary">{zoomPercent}</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="h-2 w-full accent-primary"
                />
              </label>

              <div className="grid min-w-0 grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={resetAdjustments}
                  className="min-w-0"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  초기화
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => replacementInputRef.current?.click()}
                  className="min-w-0"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  이미지 변경
                </Button>
              </div>

              <input
                ref={replacementInputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={replaceSource}
              />

              <div className="hidden min-w-0 gap-1 rounded-[1rem] border border-border bg-surface-inset px-3 py-2.5 sm:grid">
                <p className="truncate text-xs font-semibold text-foreground">저장 형식</p>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {outputSizeLabel} WebP로 저장됩니다.
                </p>
              </div>

              {error ? <FormMessage variant="error">{error}</FormMessage> : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/70 bg-surface-overlay px-3 py-2 sm:px-5 sm:py-4">
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button variant="ghost" onClick={onCancel} className="min-w-0 sm:w-auto">
              취소
            </Button>
            <Button
              onClick={exportFile}
              loading={isExporting}
              loadingText="적용 중"
              className={cn("min-w-0 sm:w-auto", isExporting ? "pointer-events-none" : null)}
            >
              적용
            </Button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
