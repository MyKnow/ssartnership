"use client";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
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
}: {
  role: MediaRole;
  title: string;
  subtitle: string;
  aspectRatio: number;
  initial?: string[] | null;
  className?: string;
  multiple?: boolean;
}) {
  const {
    items,
    draftUrl,
    setDraftUrl,
    error,
    fileInputRef,
    currentManifest,
    currentCrop,
    handleAddUrl,
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
  });

  const hasItems = items.length > 0;
  const emptyMessage = multiple
    ? "URL을 추가하거나 이미지 파일을 끌어오세요."
    : "썸네일을 선택하거나 이미지를 끌어오세요.";

  return (
    <div className={cn("grid gap-2.5", className)}>
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

      <div className="grid gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-base font-semibold leading-6 text-foreground sm:text-lg">
              {title}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {!hasItems ? (
          <div
            className="grid gap-2 rounded-2xl border border-dashed border-border bg-surface-inset px-3 py-2.5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              ingestFiles(event.dataTransfer.files);
            }}
          >
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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
              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 lg:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleAddUrl()}
                  className="w-auto"
                >
                  추가
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-auto"
                >
                  파일
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-inset/80 px-4 py-2.5 text-xs leading-6 text-muted-foreground">
              {emptyMessage}
            </div>
          </div>
        ) : null}

        {hasItems ? (
          <div className={cn("grid gap-3", multiple ? "sm:grid-cols-2" : null)}>
            {items.map((item, index) =>
              multiple ? (
                <div
                  key={item.id}
                  className="grid min-w-0 gap-2 rounded-2xl border border-border bg-surface-inset p-2"
                >
                  <div
                    className="relative overflow-hidden rounded-[18px] border border-border bg-surface-muted"
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

                  <MediaCardToolbar
                    multiple
                    onAddUrl={(url) => handleAddUrl(url, index + 1)}
                    onAddFiles={(files) => ingestFiles(files, index + 1)}
                  />

                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(index, -1)}
                      ariaLabel="위로"
                      title="위로"
                      className="h-10 w-10 min-h-10 min-w-10 disabled:border-border/50 disabled:bg-surface-muted/60 disabled:text-muted-foreground/50 disabled:shadow-none disabled:opacity-35"
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
                      className="h-10 w-10 min-h-10 min-w-10 disabled:border-border/50 disabled:bg-surface-muted/60 disabled:text-muted-foreground/50 disabled:shadow-none disabled:opacity-35"
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
                  className="grid min-w-0 gap-2.5 rounded-2xl border border-border bg-surface-inset p-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start"
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
          onCancel={dismissCurrentCrop}
          onApply={applyCurrentCrop}
        />
      ) : null}
    </div>
  );
}
