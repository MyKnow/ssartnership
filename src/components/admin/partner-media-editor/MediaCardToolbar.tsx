"use client";

import { useRef, useState } from "react";
import { ArrowUpTrayIcon, LinkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";

export default function MediaCardToolbar({
  multiple,
  allowUrl = true,
  accept = "image/*",
  onAddUrl,
  onAddUrls,
  onAddFiles,
}: {
  multiple: boolean;
  allowUrl?: boolean;
  accept?: string;
  onAddUrl: (url: string) => boolean;
  onAddUrls?: (urls: string[]) => boolean;
  onAddFiles: (files: FileList | File[] | null) => boolean;
}) {
  const [draftUrl, setDraftUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadLabel = multiple ? "파일/갤러리 업로드" : "파일 업로드";

  const submitUrl = () => {
    const urls = draftUrl
      .split(/\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
    const added =
      multiple && urls.length > 1
        ? onAddUrls
          ? onAddUrls(urls)
          : urls.every((url) => onAddUrl(url))
        : onAddUrl(draftUrl);
    if (added) {
      setDraftUrl("");
    }
  };

  return (
    <div className="grid min-w-0 gap-3 rounded-2xl border border-dashed border-border bg-surface-inset p-3">
      <div
        className={cn(
          "grid min-w-0 gap-3",
          allowUrl ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" : null,
        )}
      >
        {allowUrl ? (
          <div className="min-w-0">
            {multiple ? (
              <Textarea
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                placeholder="이미지 링크를 여러 개 붙여넣으세요. 줄바꿈 또는 | 로 구분합니다."
                className="min-h-24"
              />
            ) : (
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
            )}
          </div>
        ) : (
          <p className="min-w-0 text-sm leading-6 text-muted-foreground">
            JPG, PNG, WebP, AVIF 파일을 선택하면 구도를 조정한 뒤 저장됩니다.
          </p>
        )}
        <div
          className={cn(
            "flex w-full shrink-0 flex-wrap items-center gap-2",
            allowUrl ? "justify-end lg:w-auto" : "justify-start",
          )}
        >
          {allowUrl ? (
            <Button
              type="button"
              variant="ghost"
              onClick={submitUrl}
              className="w-auto"
            >
              <LinkIcon className="h-4 w-4" />
              추가
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className={cn(allowUrl ? "w-auto" : "w-full sm:w-auto")}
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {uploadLabel}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
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
