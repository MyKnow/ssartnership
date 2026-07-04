"use client";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { getCachedImageUrl } from "@/lib/image-cache";
import {
  PARTNER_GALLERY_ASPECT_RATIO,
  PARTNER_THUMBNAIL_ASPECT_RATIO,
} from "@/lib/partner-media";
import type { MediaRole } from "@/components/admin/partner-media-editor/types";
import MediaCardToolbar from "@/components/admin/partner-media-editor/MediaCardToolbar";
import MediaCropModal from "@/components/admin/partner-media-editor/MediaCropModal";
import useMediaFieldController from "@/components/admin/partner-media-editor/useMediaFieldController";

export default function MediaField({
  role,
  title,
  subtitle,
  aspectRatio,
  initial,
  className,
  multiple = false,
  allowUrl = true,
  accept = "image/*",
  maxItems,
  validateFile,
}: {
  role: MediaRole;
  title: string;
  subtitle: string;
  aspectRatio: number;
  initial?: string[] | null;
  className?: string;
  multiple?: boolean;
  allowUrl?: boolean;
  accept?: string;
  maxItems?: number;
  validateFile?: (file: File) => string | null;
}) {
  const {
    items,
    draftUrl,
    setDraftUrl,
    error,
    fileInputRef,
    currentManifest,
    currentCrop,
    pendingCropCount,
    handleAddUrl,
    handleAddUrls,
    ingestFiles,
    replaceItemAt,
    removeItem,
    moveItem,
    applyCurrentCrop,
    dismissCurrentCrop,
  } = useMediaFieldController({
    role,
    aspectRatio,
    initial,
    multiple,
    maxItems,
    validateFile,
  });

  const hasItems = items.length > 0;
  const canAddMore = !multiple || typeof maxItems !== "number" || items.length < maxItems;
  const emptyMessage = allowUrl
    ? multiple
      ? "여러 URL을 한 번에 추가하거나 이미지 파일을 끌어오세요."
      : "썸네일을 선택하거나 이미지를 끌어오세요."
    : multiple
      ? "이미지 파일을 선택하거나 끌어오세요."
      : "대표 이미지 파일을 선택하거나 끌어오세요.";
  const addDraftUrls = () => {
    if (!multiple) {
      return handleAddUrl();
    }
    const urls = draftUrl
      .split(/\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
    return urls.length > 1 ? handleAddUrls(urls) : handleAddUrl();
  };

  return (
    <div className={cn("grid min-w-0 gap-3", className)}>
      <input type="hidden" name={`${role}Manifest`} value={currentManifest} />
      <input
        ref={fileInputRef}
        type="file"
        name={multiple ? "galleryFiles" : "thumbnailFile"}
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => ingestFiles(event.target.files)}
      />

      <div className="grid min-w-0 gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <p className="truncate text-base font-semibold leading-6 text-foreground sm:text-lg">
              {title}
            </p>
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        {(multiple || !hasItems) && canAddMore ? (
          <div
            className="grid min-w-0 gap-3 rounded-2xl border border-dashed border-border bg-surface-inset p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              ingestFiles(event.dataTransfer.files);
            }}
          >
            <div
              className={cn(
                "grid min-w-0 gap-3",
                allowUrl ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" : null,
              )}
            >
              {allowUrl ? (
                multiple ? (
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
                        handleAddUrl();
                      }
                    }}
                    placeholder="이미지 링크를 붙여넣으세요"
                  />
                )
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
                    onClick={addDraftUrls}
                    className="w-auto"
                  >
                    추가
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(allowUrl ? "w-auto" : "w-full sm:w-auto")}
                >
                  {multiple ? "파일/갤러리" : "파일"}
                </Button>
              </div>
            </div>

            <div className="line-clamp-2 rounded-2xl border border-border bg-surface-inset/80 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
              {emptyMessage}
              {typeof maxItems === "number" ? ` 최대 ${maxItems.toLocaleString("ko-KR")}장.` : ""}
            </div>
          </div>
        ) : null}

        {hasItems ? (
          <div
            className={cn(
              "grid gap-3",
              multiple
                ? "grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))]"
                : null,
            )}
          >
            {items.map((item, index) =>
              multiple ? (
                <div
                  key={item.id}
                  className="grid min-w-0 gap-2 rounded-[1.15rem] border border-border bg-surface-inset p-2"
                >
                  <div
                    className="relative overflow-hidden rounded-[0.95rem] border border-border bg-surface-muted"
                    style={{ aspectRatio: PARTNER_GALLERY_ASPECT_RATIO }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview may use blob/object URL */}
                    <img
                      src={item.kind === "existing" ? getCachedImageUrl(item.url) : item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <Badge
                      className={cn(
                        "pointer-events-none absolute left-3 top-3 border px-2 py-1 text-[11px] font-semibold shadow-flat backdrop-blur-sm",
                        item.kind === "existing"
                          ? "border-border bg-surface-control/95 text-foreground"
                          : "border-primary/40 bg-primary/90 text-white dark:text-black",
                      )}
                    >
                      {item.kind === "existing" ? "기존 이미지" : "새 이미지"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(index, -1)}
                      ariaLabel="위로"
                      title="위로"
                      className="h-9 w-full min-h-9 min-w-0 disabled:border-border/50 disabled:bg-surface-muted/60 disabled:text-muted-foreground/50 disabled:shadow-none disabled:opacity-35"
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
                      className="h-9 w-full min-h-9 min-w-0 disabled:border-border/50 disabled:bg-surface-muted/60 disabled:text-muted-foreground/50 disabled:shadow-none disabled:opacity-35"
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
                      className="h-9 w-full min-h-9 min-w-0"
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
                      className="h-9 w-full min-h-9 min-w-0"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 rounded-2xl border border-border bg-surface-inset p-3"
                >
                  <div
                    className="relative overflow-hidden rounded-[18px] border border-border bg-surface-muted"
                    style={{ aspectRatio: PARTNER_THUMBNAIL_ASPECT_RATIO }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview may use blob/object URL */}
                    <img
                      src={item.kind === "existing" ? getCachedImageUrl(item.url) : item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <Badge
                      className={cn(
                        "pointer-events-none absolute left-3 top-3 border px-2 py-1 text-[11px] font-semibold shadow-flat backdrop-blur-sm",
                        item.kind === "existing"
                          ? "border-border bg-surface-control/95 text-foreground"
                          : "border-primary/40 bg-primary/90 text-white dark:text-black",
                      )}
                    >
                      {item.kind === "existing" ? "기존 이미지" : "새 이미지"}
                    </Badge>
                  </div>

                  <div className="grid gap-2.5">
                    <MediaCardToolbar
                      multiple={false}
                      allowUrl={allowUrl}
                      accept={accept}
                      onAddUrl={(url) => handleAddUrl(url, 0)}
                      onAddFiles={(files) => ingestFiles(files, 0)}
                    />

                    <div className="flex flex-wrap items-center justify-end gap-1">
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
          queueCount={pendingCropCount}
          onCancel={dismissCurrentCrop}
          onApply={applyCurrentCrop}
        />
      ) : null}
    </div>
  );
}
