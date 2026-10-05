import {
  ArrowDownIcon,
  ArrowUpIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { IMAGE_SOURCE_ACCEPT } from "@/lib/image-upload/policy";
import { cn } from "@/lib/cn";
import PromotionSlideTargetingFields from "./PromotionSlideTargetingFields";
import SlideBadge from "./SlideBadge";
import {
  createPlaceholderImage,
  getAudienceLabel,
  getCampusLabels,
  promotionSlideFieldId,
  type PromotionAdCampaignOption,
  type PromotionEventPageOption,
  type SlideDraft,
  type SlideUpdater,
} from "./slide-helpers";

/** One editable carousel slide: copy, order controls, image, and targeting. */
export default function PromotionSlideCard({
  slide,
  index,
  slideCount,
  editable,
  eventPageOptions,
  adCampaignOptions,
  onUpdate,
  onMove,
  onRemove,
  onImageUpload,
  onFileChange,
  registerFileInput,
}: {
  slide: SlideDraft;
  index: number;
  slideCount: number;
  editable: boolean;
  eventPageOptions: PromotionEventPageOption[];
  adCampaignOptions: PromotionAdCampaignOption[];
  onUpdate: (updater: SlideUpdater) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onImageUpload: () => void;
  onFileChange: (file: File | null) => void;
  registerFileInput: (element: HTMLInputElement | null) => void;
}) {
  const previewSrc = slide.imageSrc || createPlaceholderImage(slide.title);
  const titleInvalid = !slide.title.trim();
  const subtitleInvalid = !slide.subtitle.trim();
  const altInvalid = !slide.imageAlt.trim();
  const imageInvalid = slide.source === "database" && !slide.hasImageFile;

  return (
    <Card tone="default" className="grid gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SlideBadge>순번 {index + 1}</SlideBadge>
            <SlideBadge active={slide.isActive}>
              {slide.isActive ? "활성" : "비활성"}
            </SlideBadge>
            <SlideBadge muted>{editable ? "DB" : "Catalog"}</SlideBadge>
            {slide.adCampaignId ? (
              <SlideBadge active>제휴 캠페인</SlideBadge>
            ) : null}
            {slide.sponsorLabel ? (
              <SlideBadge muted>{slide.sponsorLabel}</SlideBadge>
            ) : null}
            {slide.audiences.map((audience) => (
              <SlideBadge key={audience} muted>
                {getAudienceLabel(audience)}
              </SlideBadge>
            ))}
            {slide.allowedCampuses.length > 0 ? (
              <SlideBadge muted>{getCampusLabels(slide.allowedCampuses)}</SlideBadge>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2">
            <Input
              id={promotionSlideFieldId(slide.id, "title")}
              aria-label={`카드 ${index + 1} 타이틀`}
              aria-invalid={titleInvalid || undefined}
              value={slide.title}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="카드 타이틀"
              disabled={!editable}
              className={
                titleInvalid
                  ? "border-danger/40 bg-danger/5 focus:border-danger"
                  : undefined
              }
            />
            <Textarea
              id={promotionSlideFieldId(slide.id, "subtitle")}
              aria-label={`카드 ${index + 1} 부제`}
              aria-invalid={subtitleInvalid || undefined}
              value={slide.subtitle}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  subtitle: event.target.value,
                }))
              }
              placeholder="카드 부제"
              rows={3}
              disabled={!editable}
              className={
                subtitleInvalid
                  ? "border-danger/40 bg-danger/5 focus:border-danger"
                  : undefined
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === 0 || !editable}
            ariaLabel="위로 이동"
            title="위로 이동"
            onClick={() => onMove(-1)}
          >
            <ArrowUpIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === slideCount - 1 || !editable}
            ariaLabel="아래로 이동"
            title="아래로 이동"
            onClick={() => onMove(1)}
          >
            <ArrowDownIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="danger"
            size="icon"
            disabled={!editable}
            ariaLabel="삭제"
            title="삭제"
            onClick={onRemove}
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="grid gap-3">
          <div
            id={promotionSlideFieldId(slide.id, "image")}
            tabIndex={-1}
            aria-label={`카드 ${index + 1} 이미지`}
            className={cn(
              "relative aspect-[21/9] overflow-hidden rounded-panel border bg-surface-inset outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              imageInvalid ? "border-danger/60" : "border-border/70",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- live preview can use blob/object URLs */}
            <img
              src={previewSrc}
              alt={slide.imageAlt || slide.title || "광고 카드 이미지"}
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <Button
              type="button"
              variant="secondary"
              disabled={!editable}
              onClick={onImageUpload}
            >
              <PhotoIcon className="size-4" />
              이미지 업로드
            </Button>
            <Input
              id={promotionSlideFieldId(slide.id, "imageAlt")}
              aria-label={`카드 ${index + 1} 이미지 대체 텍스트`}
              aria-invalid={altInvalid || undefined}
              value={slide.imageAlt}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  imageAlt: event.target.value,
                }))
              }
              placeholder="이미지 대체 텍스트"
              disabled={!editable}
              className={cn(
                "min-w-0",
                altInvalid ? "border-danger/40 bg-danger/5 focus:border-danger" : null,
              )}
            />
            <input
              ref={registerFileInput}
              type="file"
              accept={IMAGE_SOURCE_ACCEPT}
              className="hidden"
              onChange={(event) => {
                onFileChange(event.target.files?.[0] ?? null);
              }}
            />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            모든 이미지는 공통 편집 팝업에서 21:9 구도로 조정한 뒤 WebP로
            저장됩니다.
          </p>
        </div>

        <PromotionSlideTargetingFields
          slide={slide}
          editable={editable}
          eventPageOptions={eventPageOptions}
          adCampaignOptions={adCampaignOptions}
          onUpdate={onUpdate}
        />
      </div>
    </Card>
  );
}
