"use client";

import { useRef, useState } from "react";
import { ArrowUpTrayIcon, LinkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function MediaCardToolbar({
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
