"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import {
  createReviewImageItemFromFile,
  isImageFile,
  revokeIfBlobUrl,
  type ReviewImageItem,
} from "@/components/review-media/shared";
import ReviewImageCropModal from "@/components/review-media/ReviewImageCropModal";

type PendingCrop = {
  file: File;
  sourceUrl: string;
};

export default function ReviewImageUploader({
  items,
  onChange,
  error,
  disabled,
}: {
  items: ReviewImageItem[];
  onChange: (nextItems: ReviewImageItem[]) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<ReviewImageItem[]>(items);
  const pendingQueueRef = useRef<File[]>([]);
  const [activeCrop, setActiveCrop] = useState<PendingCrop | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => revokeIfBlobUrl(item.url));
      if (activeCrop) {
        revokeIfBlobUrl(activeCrop.sourceUrl);
      }
    };
  }, [activeCrop]);

  const remainingCount = Math.max(0, 5 - items.length);

  const advanceCropQueue = () => {
    const [nextFile, ...rest] = pendingQueueRef.current;
    pendingQueueRef.current = rest;
    if (!nextFile) {
      setActiveCrop(null);
      return;
    }
    setActiveCrop({
      file: nextFile,
      sourceUrl: URL.createObjectURL(nextFile),
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    const validFiles = files.filter((file) => isImageFile(file)).slice(0, remainingCount);
    if (validFiles.length === 0) {
      setLocalError("이미지 파일만 최대 5장까지 업로드할 수 있습니다.");
      return;
    }
    setLocalError(null);
    pendingQueueRef.current = [...pendingQueueRef.current, ...validFiles];
    if (!activeCrop) {
      advanceCropQueue();
    }
  };

  const handleCropCancel = () => {
    if (activeCrop) {
      revokeIfBlobUrl(activeCrop.sourceUrl);
    }
    advanceCropQueue();
  };

  const handleCropApply = (file: File) => {
    if (activeCrop) {
      revokeIfBlobUrl(activeCrop.sourceUrl);
    }
    onChange([...items, createReviewImageItemFromFile(file)]);
    setLocalError(null);
    advanceCropQueue();
  };

  const handleRemove = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (target) {
      revokeIfBlobUrl(target.url);
    }
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">사진</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || remainingCount === 0}
          className="sm:shrink-0"
        >
          <span className="inline-flex items-center gap-2">
            <PhotoIcon className="h-4 w-4" />
            추가 ({items.length}/5)
          </span>
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-muted"
            >
              <Image
                src={item.url}
                alt={`리뷰 사진 ${index + 1}`}
                fill
                sizes="(max-width: 640px) 30vw, 120px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
                onClick={() => handleRemove(item.id)}
                aria-label="리뷰 사진 제거"
                disabled={disabled}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/70 px-4 py-4 text-sm text-muted-foreground">
          선택 사항
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || remainingCount === 0}
      />

      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {localError ? <FormMessage variant="error">{localError}</FormMessage> : null}

      <ReviewImageCropModal
        open={Boolean(activeCrop)}
        sourceUrl={activeCrop?.sourceUrl ?? ""}
        outputName={`review-${items.length + 1}.webp`}
        onCancel={handleCropCancel}
        onApply={handleCropApply}
      />
    </div>
  );
}
