"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowUpTrayIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { getCachedImageUrl } from "@/lib/image-cache";
import {
  PARTNER_GALLERY_ASPECT_RATIO,
  PARTNER_THUMBNAIL_ASPECT_RATIO,
  type PartnerMediaManifestEntry,
} from "@/lib/partner-media";
import { sanitizeHttpUrl } from "@/lib/validation";

type MediaRole = "thumbnail" | "gallery";

type MediaItem = {
  id: string;
  kind: "existing" | "file";
  url: string;
  file?: File;
};

type PendingCrop = {
  id: string;
  sourceUrl: string;
  aspectRatio: number;
  outputName: string;
  onApply: (file: File) => void;
};

function isBlobUrl(value: string) {
  return value.startsWith("blob:");
}

function revokeIfBlobUrl(value: string) {
  if (isBlobUrl(value)) {
    URL.revokeObjectURL(value);
  }
}

function makeObjectUrl(file: File) {
  return URL.createObjectURL(file);
}

function createWebpFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(avif|gif|jpe?g|png|svg|webp|bmp|heic|heif)$/i.test(file.name);
}

function createPreviewEntryFromFile(file: File): MediaItem {
  return {
    id: crypto.randomUUID(),
    kind: "file",
    url: makeObjectUrl(file),
    file,
  };
}

function createPreviewEntryFromExisting(url: string): MediaItem {
  return {
    id: crypto.randomUUID(),
    kind: "existing",
    url,
  };
}

function MediaCardToolbar({
  multiple,
  onAddUrl,
  onAddFiles,
}: {
  multiple: boolean;
  onAddUrl: (url: string) => boolean;
  onAddFiles: (files: FileList | File[] | null) => boolean;
}) {
  const [draftUrl, setDraftUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadLabel = multiple ? "파일/갤러리 업로드" : "파일 업로드";

  const submitUrl = () => {
    if (onAddUrl(draftUrl)) {
      setDraftUrl("");
    }
  };

  return (
    <div className="grid gap-2 rounded-2xl border border-dashed border-border bg-surface px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitUrl();
            }
          }}
          placeholder="이미지 링크를 붙여넣으세요"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={submitUrl}
            className="w-full sm:w-auto"
          >
            <LinkIcon className="h-4 w-4" />
            추가
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {uploadLabel}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          if (onAddFiles(event.target.files)) {
            event.target.value = "";
          }
        }}
      />
    </div>
  );
}

function manifestEntryForItem(item: MediaItem): PartnerMediaManifestEntry {
  if (item.kind === "existing") {
    return {
      kind: "existing",
      url: item.url,
    };
  }
  return { kind: "upload" };
}

function manifestForItems(items: MediaItem[]) {
  return items.map((item) => manifestEntryForItem(item));
}

function setInputFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input) {
    return;
  }
  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
  }
  input.files = dataTransfer.files;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function inferOutputName(role: MediaRole, index: number) {
  return `${role}-${index + 1}.webp`;
}

function MediaCropModal({
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

  const scaledWidth = imageState
    ? imageState.naturalWidth * fitScale * zoom
    : 0;
  const scaledHeight = imageState
    ? imageState.naturalHeight * fitScale * zoom
    : 0;
  const maxOffsetX = imageState
    ? Math.max(0, (scaledWidth - frameSize.width) / 2)
    : 0;
  const maxOffsetY = imageState
    ? Math.max(0, (scaledHeight - frameSize.height) / 2)
    : 0;
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
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
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
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
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
      <div className="my-auto grid w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] gap-4 overflow-y-auto rounded-[28px] border border-white/10 bg-surface p-4 shadow-2xl sm:p-5">
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
                {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL crop preview */}
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

function MediaField({
  role,
  title,
  subtitle,
  aspectRatio,
  initial,
  className,
  multiple = false,
}: {
  role: MediaRole;
  title: string;
  subtitle: string;
  aspectRatio: number;
  initial?: string[] | null;
  className?: string;
  multiple?: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>(() =>
    (initial ?? []).filter(Boolean).map((url) => createPreviewEntryFromExisting(url)),
  );
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingCrops, setPendingCrops] = useState<PendingCrop[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentBlobUrls = new Set(
      items.filter((item) => item.kind === "file" && isBlobUrl(item.url)).map((item) => item.url),
    );

    for (const url of createdBlobUrlsRef.current) {
      if (!currentBlobUrls.has(url)) {
        URL.revokeObjectURL(url);
      }
    }
    createdBlobUrlsRef.current = currentBlobUrls;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const url of createdBlobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const fileItems = useMemo(
    () => items.filter((item) => item.kind === "file" && item.file),
    [items],
  );

  const enqueueCrop = (pending: PendingCrop | PendingCrop[]) => {
    const queue = Array.isArray(pending) ? pending : [pending];
    setPendingCrops((prev) => [...prev, ...queue]);
  };

  const currentCrop = pendingCrops[0] ?? null;

  const finishCurrentCrop = (file: File, insertAt?: number) => {
    setItems((prev) => {
      const nextEntry = createPreviewEntryFromFile(file);
      if (!multiple && prev.length > 0) {
        const previous = prev[0];
        if (previous) {
          revokeIfBlobUrl(previous.url);
        }
        return [nextEntry];
      }

      if (typeof insertAt === "number") {
        const copy = [...prev];
        const safeIndex = Math.max(0, Math.min(insertAt, copy.length));
        copy.splice(safeIndex, 0, nextEntry);
        return copy;
      }

      return [...prev, nextEntry];
    });

    setPendingCrops((prev) => prev.slice(1));
    setError(null);
  };

  const cancelCurrentCrop = () => {
    setPendingCrops((prev) => prev.slice(1));
  };

  const queueFile = (file: File, index: number, insertAt?: number) => {
    const pendingId = crypto.randomUUID();
    const objectUrl = makeObjectUrl(file);
    const sourceUrl = objectUrl;
    createdBlobUrlsRef.current.add(objectUrl);
    enqueueCrop({
      id: pendingId,
      sourceUrl,
      aspectRatio,
      outputName: inferOutputName(role, index),
      onApply: (croppedFile) => {
        revokeIfBlobUrl(objectUrl);
        finishCurrentCrop(croppedFile, insertAt);
      },
    });
  };

  const ingestFiles = (
    files: FileList | File[] | null,
    insertAt?: number,
  ) => {
    if (!files || files.length === 0) {
      return false;
    }

    const picked = Array.from(files);
    if (picked.some((file) => !isImageFile(file))) {
      setError("이미지 파일만 추가할 수 있습니다.");
      return false;
    }

    setError(null);
    picked.forEach((file, index) =>
      queueFile(
        file,
        index,
        typeof insertAt === "number" ? insertAt + index : undefined,
      ),
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return true;
  };

  const handleAddUrl = (rawUrl?: string, insertAt?: number) => {
    const safe = sanitizeHttpUrl(rawUrl ?? draftUrl);
    if (!safe) {
      setError("이미지 링크는 올바른 http(s) 주소여야 합니다.");
      return false;
    }

    setError(null);
    const pendingId = crypto.randomUUID();
    const sourceUrl = getCachedImageUrl(safe);
    enqueueCrop({
      id: pendingId,
      sourceUrl,
      aspectRatio,
      outputName: inferOutputName(
        role,
        typeof insertAt === "number" ? insertAt : items.length,
      ),
      onApply: (croppedFile) => {
        finishCurrentCrop(croppedFile, insertAt);
      },
    });
    if (!rawUrl) {
      setDraftUrl("");
    }
    return true;
  };

  const replaceItemAt = (index: number) => {
    const item = items[index];
    if (!item) {
      return;
    }

    const sourceUrl =
      item.kind === "existing" ? getCachedImageUrl(item.url) : item.url;

    enqueueCrop({
      id: item.id,
      sourceUrl,
      aspectRatio,
      outputName: inferOutputName(role, index),
      onApply: (croppedFile) => {
        setItems((prev) => {
          const copy = [...prev];
          const previous = copy[index];
          if (previous) {
            revokeIfBlobUrl(previous.url);
          }
          copy[index] = createPreviewEntryFromFile(croppedFile);
          return copy;
        });
        setPendingCrops((prev) => prev.slice(1));
        setError(null);
      },
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const removed = copy[index];
      if (!removed) {
        return prev;
      }
      if (removed.kind === "file") {
        revokeIfBlobUrl(removed.url);
      }
      copy.splice(index, 1);
      return copy;
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (!removed) {
        return prev;
      }
      copy.splice(nextIndex, 0, removed);
      return copy;
    });
  };

  const currentManifest = useMemo(() => {
    if (!multiple) {
      const item = items[0];
      return JSON.stringify({
        thumbnail: item ? manifestEntryForItem(item) : null,
        gallery: [],
      });
    }
    return JSON.stringify({
      thumbnail: null,
      gallery: manifestForItems(items),
    });
  }, [items, multiple]);

  const currentFiles = useMemo(() => fileItems.map((item) => item.file as File), [fileItems]);

  useEffect(() => {
    setInputFiles(fileInputRef.current, currentFiles);
  }, [currentFiles]);

  const hasItems = items.length > 0;
  const emptyMessage = multiple
    ? "URL을 추가하거나 이미지 파일을 끌어오세요."
    : "썸네일을 선택하거나 이미지를 끌어오세요.";

  return (
    <div className={cn("grid gap-3", className)}>
      <input type="hidden" name={`${role}Manifest`} value={currentManifest} />
      <input
        ref={fileInputRef}
        type="file"
        name={multiple ? "galleryFiles" : "thumbnailFile"}
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(event) => ingestFiles(event.target.files)}
      />

      <div className="grid gap-3 rounded-3xl border border-border bg-surface-muted p-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {!hasItems ? (
            <div
              className="grid gap-2 rounded-2xl border border-dashed border-border bg-surface px-3 py-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                ingestFiles(event.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  placeholder="이미지 링크를 붙여넣으세요"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleAddUrl()}
                    className="w-full sm:w-auto"
                  >
                    <LinkIcon className="h-4 w-4" />
                    추가
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    파일
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-xs leading-6 text-muted-foreground">
                {emptyMessage}
              </div>
            </div>
          ) : null}
        </div>

        {hasItems ? (
          <div className={cn("grid gap-3", multiple ? "sm:grid-cols-2" : null)}>
            {items.map((item, index) =>
              multiple ? (
                <div
                  key={item.id}
                  className="grid min-w-0 gap-2 rounded-2xl border border-border bg-surface p-2"
                >
                  <div
                    className="relative overflow-hidden rounded-[18px] border border-border bg-surface-muted"
                    style={{ aspectRatio: PARTNER_GALLERY_ASPECT_RATIO }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL preview */}
                    <img
                      src={item.kind === "existing" ? getCachedImageUrl(item.url) : item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <Badge
                      className={cn(
                        "pointer-events-none absolute left-3 top-3 border px-2 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-sm",
                        item.kind === "existing"
                          ? "border-border bg-background/95 text-foreground"
                          : "border-primary/40 bg-primary/90 text-white dark:text-black",
                      )}
                    >
                      {item.kind === "existing" ? "기존 이미지" : "새 이미지"}
                    </Badge>
                  </div>

                  <MediaCardToolbar
                    multiple={multiple}
                    onAddUrl={(url) => handleAddUrl(url, index + 1)}
                    onAddFiles={(files) => ingestFiles(files, index + 1)}
                  />

                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(index, -1)}
                      ariaLabel="위로"
                      title="위로"
                      className="h-10 w-10 min-h-10 min-w-10"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(index, 1)}
                      ariaLabel="아래로"
                      title="아래로"
                      className="h-10 w-10 min-h-10 min-w-10"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => replaceItemAt(index)}
                      ariaLabel="구도 수정"
                      title="구도 수정"
                      className="h-10 w-10 min-h-10 min-w-10"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      onClick={() => removeItem(index)}
                      ariaLabel="삭제"
                      title="삭제"
                      className="h-10 w-10 min-h-10 min-w-10"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start"
                >
                  <div
                    className="relative overflow-hidden rounded-[18px] border border-border bg-surface-muted"
                    style={{ aspectRatio: PARTNER_THUMBNAIL_ASPECT_RATIO }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL preview */}
                    <img
                      src={item.kind === "existing" ? getCachedImageUrl(item.url) : item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <Badge
                      className={cn(
                        "pointer-events-none absolute left-3 top-3 border px-2 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-sm",
                        item.kind === "existing"
                          ? "border-border bg-background/95 text-foreground"
                          : "border-primary/40 bg-primary/90 text-white dark:text-black",
                      )}
                    >
                      {item.kind === "existing" ? "기존 이미지" : "새 이미지"}
                    </Badge>
                  </div>

                  <div className="grid gap-3">
                    <MediaCardToolbar
                      multiple={multiple}
                      onAddUrl={(url) => handleAddUrl(url, 0)}
                      onAddFiles={(files) => ingestFiles(files, 0)}
                    />

                    <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => replaceItemAt(index)}
                        ariaLabel="구도 수정"
                        title="구도 수정"
                        className="h-10 w-10 min-h-10 min-w-10"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="icon"
                        onClick={() => removeItem(index)}
                        ariaLabel="삭제"
                        title="삭제"
                        className="h-10 w-10 min-h-10 min-w-10"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : null}
      </div>

      {error ? <FormMessage variant="error">{error}</FormMessage> : null}

      {currentCrop ? (
        <MediaCropModal
          key={currentCrop.id}
          open={Boolean(currentCrop)}
          title={title}
          subtitle={subtitle}
          aspectRatio={currentCrop.aspectRatio}
          sourceUrl={currentCrop.sourceUrl}
          outputName={currentCrop.outputName}
          onCancel={() => {
            if (currentCrop && isBlobUrl(currentCrop.sourceUrl)) {
              revokeIfBlobUrl(currentCrop.sourceUrl);
            }
            cancelCurrentCrop();
          }}
          onApply={(file) => {
            currentCrop.onApply(file);
            if (currentCrop && isBlobUrl(currentCrop.sourceUrl)) {
              revokeIfBlobUrl(currentCrop.sourceUrl);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export function PartnerThumbnailField({
  initial,
  className,
}: {
  initial?: string | null;
  className?: string;
}) {
  return (
    <MediaField
      role="thumbnail"
      title="메인 썸네일"
      subtitle="카드 목록에서 보일 1:1 이미지입니다."
      aspectRatio={PARTNER_THUMBNAIL_ASPECT_RATIO}
      initial={initial ? [initial] : []}
      className={className}
      multiple={false}
    />
  );
}

export function PartnerGalleryField({
  initial,
  className,
}: {
  initial?: string[];
  className?: string;
}) {
  return (
    <MediaField
      role="gallery"
      title="추가 이미지"
      subtitle="상세 페이지에서 보일 4:3 이미지들입니다."
      aspectRatio={PARTNER_GALLERY_ASPECT_RATIO}
      initial={initial ?? []}
      className={className}
      multiple
    />
  );
}
