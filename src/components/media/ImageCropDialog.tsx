"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import {
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { type ImageTransformPolicy } from "@/lib/image-upload/policy";

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

export default function ImageCropDialog({
  open,
  aspectRatio,
  sourceUrl,
  sourceFile,
  outputName,
  outputWidth,
  outputHeight,
  quality = 0.78,
  policy,
  onCancel,
  onApply,
}: {
  open: boolean;
  aspectRatio: number;
  sourceUrl: string;
  sourceFile?: File;
  outputName: string;
  outputWidth: number;
  outputHeight: number;
  quality?: number;
  policy?: ImageTransformPolicy;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const { notify } = useToast();
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresServerFallback, setRequiresServerFallback] = useState(false);
  const effectiveOutputWidth = policy?.width ?? outputWidth;
  const effectiveOutputHeight = policy?.height ?? outputHeight;
  const effectiveAspectRatio = policy?.aspectRatio ?? aspectRatio;
  const effectiveQuality = policy ? policy.quality / 100 : quality;

  useEffect(() => {
    if (!open || !portalRoot) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
    setError(null);
    setRequiresServerFallback(false);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, portalRoot, sourceFile, sourceUrl]);

  const exportFile = async () => {
    if (requiresServerFallback && sourceFile) {
      setIsExporting(true);
      try {
        onApply(sourceFile);
      } finally {
        setIsExporting(false);
      }
      return;
    }
    if (!croppedAreaPixels) {
      const message = "이미지를 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.";
      setError(message);
      notify(message);
      return;
    }
    setIsExporting(true);
    try {
      const file = await exportCroppedImage({
        sourceUrl,
        crop: croppedAreaPixels,
        outputName,
        outputWidth: effectiveOutputWidth,
        outputHeight: effectiveOutputHeight,
        quality: effectiveQuality,
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

  const outputSizeLabel = `${effectiveOutputWidth.toLocaleString("ko-KR")}x${effectiveOutputHeight.toLocaleString("ko-KR")}`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-x-hidden overflow-y-auto bg-black/70 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-surface-overlay shadow-overlay sm:max-h-[calc(100dvh-3rem)] sm:rounded-[1.75rem]">
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
          <h2
            data-testid="image-crop-dialog-title"
            className="min-w-0 text-ko-title text-base font-semibold text-foreground"
          >
            이미지 편집
          </h2>
          <Button variant="ghost" size="icon" onClick={onCancel} ariaLabel="닫기" title="닫기">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        <div
          data-testid="image-crop-dialog-content"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-5 sm:py-4"
        >
          <div className="grid min-h-0 gap-3 sm:gap-4">
            <div
              data-testid="image-crop-frame"
              className="relative h-[clamp(15.5rem,42dvh,21rem)] w-full min-w-0 overflow-hidden rounded-[1.35rem] border border-border bg-slate-950/95 sm:h-[clamp(18rem,42dvh,26rem)] xl:h-[clamp(22rem,52dvh,32rem)]"
            >
              {requiresServerFallback && sourceFile ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm leading-6 text-slate-200">
                  <PhotoIcon className="h-10 w-10 text-slate-400" />
                  <p className="font-semibold">이 브라우저에서는 미리보기를 지원하지 않는 형식입니다.</p>
                  <p className="max-w-md text-xs leading-5 text-slate-400">
                    원본은 비공개 Staging으로 전송된 뒤 서버에서 {outputSizeLabel} WebP로 안전하게 변환됩니다. 이 경우 중앙 기준으로 맞춰집니다.
                  </p>
                </div>
              ) : (
                <Cropper
                  image={sourceUrl}
                  crop={crop}
                  zoom={1}
                  aspect={effectiveAspectRatio}
                  restrictPosition
                  showGrid
                  zoomWithScroll={false}
                  onCropChange={setCrop}
                  onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                  onMediaLoaded={() => {
                    setRequiresServerFallback(false);
                    setError(null);
                  }}
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
                      if (sourceFile) {
                        setRequiresServerFallback(true);
                        setError(null);
                        return;
                      }
                      setError("이미지를 불러올 수 없습니다. 팝업을 닫고 다른 파일을 선택해 주세요.");
                    },
                  }}
                />
              )}
            </div>

            {error ? <FormMessage variant="error">{error}</FormMessage> : null}
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
              loadingText={requiresServerFallback ? "서버 변환 준비 중" : "적용 중"}
              disabled={requiresServerFallback && !sourceFile}
              className={cn("min-w-0 sm:w-auto", isExporting ? "pointer-events-none" : null)}
            >
              {requiresServerFallback ? "서버 변환으로 계속" : "적용"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
