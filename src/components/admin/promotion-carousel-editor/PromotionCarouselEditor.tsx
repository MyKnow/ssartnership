"use client";

import { useMemo, useRef } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import MediaCropModal from "@/components/admin/partner-media-editor/MediaCropModal";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import type { ManagedPromotionSlide } from "@/lib/promotions/events";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  formatPromotionSlideError,
  validatePromotionSlide,
  type PromotionSlideField,
} from "@/lib/promotions/slide-validation";
import PromotionCarouselPreviewCard from "./PromotionCarouselPreviewCard";
import PromotionSlideCard from "./PromotionSlideCard";
import {
  buildPromotionPreviewSlides,
  collectPendingSlideUploads,
  PROMOTION_ASPECT_RATIO,
  promotionSlideFieldId,
  serializePromotionSlidesForSubmit,
  type PromotionAdCampaignOption,
  type PromotionEventPageOption,
  type SlideDraft,
} from "./slide-helpers";
import { usePromotionCarouselDraft } from "./usePromotionCarouselDraft";
import { usePromotionSlides } from "./usePromotionSlides";

export type {
  PromotionAdCampaignOption,
  PromotionEventPageOption,
} from "./slide-helpers";

export default function PromotionCarouselEditor({
  initialSlides,
  eventPageOptions,
  adCampaignOptions,
  saveAction,
  canUpdate = true,
}: {
  initialSlides: ManagedPromotionSlide[];
  eventPageOptions: PromotionEventPageOption[];
  adCampaignOptions: PromotionAdCampaignOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
  canUpdate?: boolean;
}) {
  const {
    slides,
    setSlides,
    previewUrlRefs,
    pendingCrop,
    error,
    setError,
    registerFileInput,
    updateSlide,
    addSlide,
    moveSlide,
    removeSlide,
    onFileChange,
    applyCroppedImage,
    handleImageUpload,
    closeCrop,
  } = usePromotionSlides({ initialSlides, canUpdate });
  const formRef = useRef<HTMLFormElement | null>(null);
  const allowUploadedFormSubmitRef = useRef(false);
  const isSubmittingImagesRef = useRef(false);
  const persistDraft = usePromotionCarouselDraft({
    slides,
    setSlides,
    previewUrlRefs,
  });

  const previewSlides = useMemo(
    () => buildPromotionPreviewSlides(slides),
    [slides],
  );

  const serializedSlides = useMemo(
    () => serializePromotionSlidesForSubmit(slides),
    [slides],
  );

  const validationIssues = useMemo(
    () =>
      slides.flatMap((slide, index) =>
        validatePromotionSlide({
          ...slide,
          hasImage: slide.source !== "database" || slide.hasImageFile,
        }).map((issue) => ({
          ...issue,
          slideId: slide.id,
          text: formatPromotionSlideError(issue.code, index + 1),
        })),
      ),
    [slides],
  );

  function focusSlideField(slideId: string, field: PromotionSlideField) {
    const target = document.getElementById(promotionSlideFieldId(slideId, field));
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const editableCount = slides.filter(
    (slide) => slide.source === "database",
  ).length;
  const canEdit = canUpdate && editableCount > 0;
  const canSave =
    canUpdate &&
    slides.length > 0 &&
    slides.every((slide) => slide.source === "database") &&
    validationIssues.length === 0;

  function isEditable(slide: SlideDraft) {
    return canUpdate && slide.source === "database";
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (!canUpdate) {
      event.preventDefault();
      return;
    }
    if (allowUploadedFormSubmitRef.current) {
      allowUploadedFormSubmitRef.current = false;
      return;
    }
    const [firstIssue] = validationIssues;
    if (firstIssue) {
      event.preventDefault();
      void persistDraft();
      setError(firstIssue.text);
      focusSlideField(firstIssue.slideId, firstIssue.field);
      return;
    }
    if (pendingCrop) {
      event.preventDefault();
      void persistDraft();
      setError("이미지 조정을 완료한 뒤 저장해 주세요.");
      return;
    }
    const uploads = collectPendingSlideUploads(slides);
    if (uploads.length === 0) {
      void persistDraft();
      return;
    }
    event.preventDefault();
    if (isSubmittingImagesRef.current) {
      return;
    }
    const form = event.currentTarget;
    isSubmittingImagesRef.current = true;
    setError(null);
    try {
      await persistDraft();
      const results = await uploadImagesToStaging({
        purpose: "promotion",
        actorMode: "admin",
        uploads,
      });
      const uploadIdsBySlideId = new Map(
        results.map((result) => [result.clientId, result.uploadId]),
      );
      const nextSlides = slides.map((slide) => {
        const uploadId = uploadIdsBySlideId.get(slide.id);
        return uploadId ? { ...slide, uploadId, imageFile: undefined } : slide;
      });
      setSlides(nextSlides);
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      await persistDraft(nextSlides);
      allowUploadedFormSubmitRef.current = true;
      form.requestSubmit();
    } catch (uploadError) {
      void uploadError;
      setError(
        "광고 이미지를 업로드하지 못했습니다. 입력한 내용은 유지됩니다.",
      );
    } finally {
      isSubmittingImagesRef.current = false;
    }
  };

  return (
    <div className="grid gap-6">
      <PromotionCarouselPreviewCard previewSlides={previewSlides} />

      <form
        ref={formRef}
        action={saveAction}
        onSubmit={handleSubmit}
        className="grid gap-6"
      >
        <input type="hidden" name="slidesJson" value={serializedSlides} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-kicker">편집</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              광고 카드 편집
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              순서, 노출 권한, 문구, 이미지 편집을 한 화면에서 처리합니다.
            </p>
          </div>
          {canUpdate ? (
            <Button
              type="button"
              variant="secondary"
              onClick={addSlide}
              className="w-full sm:w-auto"
            >
              <PlusIcon className="size-4" />
              카드 추가
            </Button>
          ) : null}
        </div>

        {error ? <FormMessage variant="error">{error}</FormMessage> : null}
        {validationIssues.length > 0 ? (
          <FormMessage variant="info">
            저장 전 확인이 필요한 항목이 {validationIssues.length}개 있습니다.
            첫 번째 항목: {validationIssues[0].text}{" "}
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2"
              onClick={() =>
                focusSlideField(validationIssues[0].slideId, validationIssues[0].field)
              }
            >
              항목으로 이동
            </button>
          </FormMessage>
        ) : null}
        {!canUpdate ? (
          <FormMessage variant="info">
            현재 계정은 광고 카드를 조회할 수 있지만 수정할 수 없습니다.
          </FormMessage>
        ) : null}
        {canUpdate && !canEdit ? (
          <FormMessage variant="info">
            현재 로드된 카드가 모두 미리보기용이라 기존 카드 수정은 막혀
            있습니다. 새 카드는 추가할 수 있습니다.
          </FormMessage>
        ) : null}

        <section className="grid gap-4" aria-label="광고 카드 목록">
          {slides.map((slide, index) => (
            <PromotionSlideCard
              key={slide.id}
              slide={slide}
              index={index}
              slideCount={slides.length}
              editable={isEditable(slide)}
              eventPageOptions={eventPageOptions}
              adCampaignOptions={adCampaignOptions}
              onUpdate={(updater) => updateSlide(slide.id, updater)}
              onMove={(direction) => moveSlide(slide.id, direction)}
              onRemove={() => removeSlide(slide.id)}
              onImageUpload={() => handleImageUpload(slide.id)}
              onFileChange={(file) => {
                void onFileChange(slide.id, file);
              }}
              registerFileInput={(element) => registerFileInput(slide.id, element)}
            />
          ))}
        </section>

        {canUpdate ? (
          <div
            data-floating-submit-button="raised"
            className="fixed bottom-safe-bottom-20 left-5 z-[45] md:left-auto md:right-[5.5rem]"
          >
            <SubmitButton
              variant="primary"
              className="rounded-full px-6 shadow-floating"
              disabled={!canSave}
              pendingText="저장 중"
            >
              저장
            </SubmitButton>
          </div>
        ) : null}
      </form>

      <MediaCropModal
        open={Boolean(pendingCrop)}
        aspectRatio={PROMOTION_ASPECT_RATIO}
        sourceUrl={pendingCrop?.sourceUrl ?? ""}
        sourceFile={pendingCrop?.sourceFile}
        outputName={`${pendingCrop?.slideId ?? "promotion"}-slide.webp`}
        purpose="promotion"
        role="slide"
        onCancel={closeCrop}
        onApply={applyCroppedImage}
      />
    </div>
  );
}
