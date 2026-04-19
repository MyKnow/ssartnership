"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { getCachedImageUrl } from "@/lib/image-cache";

function normalize(value: string) {
  return value.trim();
}

export default function ImageListEditor({
  name,
  initial,
  className,
}: {
  name: string;
  initial?: string[];
  className?: string;
}) {
  const [images, setImages] = useState<string[]>(() => initial ?? []);
  const [newUrl, setNewUrl] = useState("");

  const serialized = useMemo(() => images.join("\n"), [images]);

  const addImage = () => {
    const value = normalize(newUrl);
    if (!value) {
      return;
    }
    setImages((prev) => [...prev, value]);
    setNewUrl("");
  };

  const updateImage = (index: number, value: string) => {
    setImages((prev) =>
      prev.map((item, idx) => (idx === index ? value : item)),
    );
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, removed);
      return copy;
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className={cn("grid gap-3", className)}>
      <input type="hidden" name={name} value={serialized} />
      {images.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          등록된 이미지가 없습니다. URL을 추가해 주세요.
        </p>
      ) : (
        <div className="grid gap-2">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={url}
                  onChange={(event) =>
                    updateImage(index, normalize(event.target.value))
                  }
                  placeholder="이미지 URL"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveImage(index, -1)}
                    ariaLabel="위로"
                    title="위로"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveImage(index, 1)}
                    ariaLabel="아래로"
                    title="아래로"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="icon"
                    onClick={() => removeImage(index)}
                    ariaLabel="삭제"
                    title="삭제"
                  >
                    ✕
                  </Button>
                </div>
              </div>
              <div className="h-24 w-full overflow-hidden rounded-xl border border-border bg-surface-muted">
                {url ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={getCachedImageUrl(url)}
                      alt=""
                      fill
                      sizes="320px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={newUrl}
          onChange={(event) => setNewUrl(event.target.value)}
          placeholder="새 이미지 URL 추가"
        />
        <Button type="button" variant="ghost" size="icon" onClick={addImage} ariaLabel="추가" title="추가">
          +
        </Button>
      </div>
    </div>
  );
}
