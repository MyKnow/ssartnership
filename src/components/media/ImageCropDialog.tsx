"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/Toast";

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
  title,
  subtitle,
  aspectRatio,
  sourceUrl,
  outputName,
  outputWidth,
  outputHeight,
  quality = 0.78,
  queueCount = 1,
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
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const { notify } = useToast();
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !portalRoot) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, portalRoot, sourceUrl]);

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
        sourceUrl,
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="my-auto grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl min-w-0 gap-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-surface-overlay p-4 shadow-overlay sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{title}</p>
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
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

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_20rem] lg:items-stretch">
          <div
            className="relative min-h-[18rem] w-full min-w-0 overflow-hidden rounded-[1.5rem] border border-border bg-slate-950/90 sm:min-h-[24rem]"
            style={{ aspectRatio }}
          >
            <Cropper
              image={sourceUrl}
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
              mediaProps={{
                onError: () => {
                  setCroppedAreaPixels(null);
                  setError("이미지를 불러올 수 없습니다. 다른 파일을 선택해 주세요.");
                },
              }}
            />
          </div>

          <div className="grid min-h-0 gap-4 rounded-[1.5rem] border border-border bg-surface-muted p-4 lg:overflow-y-auto">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">조정</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                이미지를 드래그해서 위치를 맞추고 확대 정도를 조절하세요.
              </p>
            </div>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
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
            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
              저장 크기 {outputWidth.toLocaleString("ko-KR")}x{outputHeight.toLocaleString("ko-KR")} WebP
            </p>
            {error ? <FormMessage variant="error">{error}</FormMessage> : null}
            <div className="flex flex-col gap-2">
              <Button onClick={exportFile} loading={isExporting} loadingText="적용 중">
                적용
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                취소
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
