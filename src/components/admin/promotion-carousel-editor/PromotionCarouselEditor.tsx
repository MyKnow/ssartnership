"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PromotionCarousel from "@/components/promotions/PromotionCarousel";
import MediaCropModal from "@/components/admin/partner-media-editor/MediaCropModal";
import { CAMPUS_DIRECTORY, type CampusSlug } from "@/lib/campuses";
import { isImageFile, setInputFiles } from "@/components/admin/partner-media-editor/utils";
import {
  DEFAULT_PROMOTION_AUDIENCES,
  PROMOTION_AUDIENCE_OPTIONS,
  type PromotionAudience,
} from "@/lib/promotions/catalog";
import type { ManagedPromotionSlide } from "@/lib/promotions/events";
import { cn } from "@/lib/cn";

const PROMOTION_ASPECT_RATIO = 21 / 9;

type SlideDraft = {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  hasImageFile: boolean;
  imageAlt: string;
  href: string;
  isActive: boolean;
  audiences: PromotionAudience[];
  allowedCampuses: CampusSlug[];
  source: "database" | "catalog";
};

type PendingCrop = {
  slideId: string;
  sourceUrl: string;
};

function createPlaceholderImage(title: string) {
  const safeTitle = title.replace(/[&<>"]/g, "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="2100" height="900" viewBox="0 0 2100 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f2348"/>
          <stop offset="100%" stop-color="#1f3f78"/>
        </linearGradient>
      </defs>
      <rect width="2100" height="900" rx="56" fill="url(#bg)"/>
      <rect x="120" y="120" width="900" height="220" rx="28" fill="rgba(255,255,255,0.10)"/>
      <text x="120" y="230" fill="#ffffff" font-family="Pretendard, Arial, sans-serif" font-size="68" font-weight="700">
        ${safeTitle || "광고 카드 이미지"}
      </text>
      <text x="120" y="310" fill="rgba(255,255,255,0.75)" font-family="Pretendard, Arial, sans-serif" font-size="34">
        이미지를 업로드해 주세요.
      </text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

function normalizeCampusSlug(value: string) {
  const direct = CAMPUS_DIRECTORY.find((item) => item.slug === value);
  if (direct) {
    return direct.slug;
  }
  const fallback = CAMPUS_DIRECTORY.find(
    (item) => item.label === value || item.fullLabel === value,
  );
  return fallback?.slug ?? value;
}

function toDraftSlide(slide: ManagedPromotionSlide): SlideDraft {
  const allowedCampuses = slide.allowedCampuses
    .map((campus) => normalizeCampusSlug(campus))
    .filter((campus): campus is CampusSlug => Boolean(CAMPUS_DIRECTORY.find((item) => item.slug === campus)));

  return {
    id: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    imageSrc: slide.imageSrc || createPlaceholderImage(slide.title),
    hasImageFile: slide.source === "database",
    imageAlt: slide.imageAlt,
    href: slide.href,
    isActive: slide.isActive,
    audiences:
      slide.audiences.length > 0 ? [...slide.audiences] : [...DEFAULT_PROMOTION_AUDIENCES],
    allowedCampuses,
    source: slide.source,
  };
}

function getFileInputName(id: string) {
  return `slide_image_${id}`;
}

function SlideBadge({
  children,
  active = false,
  muted = false,
}: {
  children: React.ReactNode;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        active
          ? "border-primary/20 bg-primary-soft text-primary"
          : muted
            ? "border-border bg-surface-inset text-muted-foreground"
            : "border-border/70 bg-surface-inset text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function getAudienceLabel(value: PromotionAudience) {
  return PROMOTION_AUDIENCE_OPTIONS.find((item) => item.key === value)?.label ?? value;
}

function toggleAudience(
  audiences: PromotionAudience[],
  key: PromotionAudience,
  checked: boolean,
) {
  if (checked) {
    return audiences.includes(key) ? audiences : [...audiences, key];
  }
  return audiences.filter((item) => item !== key);
}

export default function PromotionCarouselEditor({
  initialSlides,
  saveAction,
}: {
  initialSlides: ManagedPromotionSlide[];
  saveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [slides, setSlides] = useState<SlideDraft[]>(
    () => initialSlides.map((slide) => toDraftSlide(slide)),
  );
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef(new Map<string, HTMLInputElement | null>());
  const previewUrlRefs = useRef(new Map<string, string>());
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const previewUrls = previewUrlRefs.current;
    return () => {
      for (const url of previewUrls.values()) {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }
      previewUrls.clear();
    };
  }, []);

  const previewSlides = useMemo(
    () =>
      slides
        .filter((slide) => slide.imageSrc)
        .map((slide) => ({
          id: slide.id,
          title: slide.title || "광고 카드",
          description: slide.subtitle || "",
          imageSrc: slide.imageSrc,
          hasImageFile: slide.hasImageFile,
          imageAlt: slide.imageAlt || slide.title || "광고 카드 이미지",
          href: slide.href || "#",
          audiences: slide.audiences,
          allowedCampuses: slide.allowedCampuses,
        })),
    [slides],
  );

  const serializedSlides = useMemo(
    () =>
      JSON.stringify(
        slides.map((slide) => ({
          id: slide.id,
          title: slide.title,
          subtitle: slide.subtitle,
          imageSrc: slide.imageSrc,
          hasImageFile: slide.hasImageFile,
          imageAlt: slide.imageAlt,
          href: slide.href,
          isActive: slide.isActive,
          audiences: slide.audiences,
          allowedCampuses: slide.allowedCampuses,
        })),
      ),
    [slides],
  );

  const validationErrors = useMemo(() => {
    const issues: string[] = [];
    slides.forEach((slide, index) => {
      const label = `카드 ${index + 1}`;
      if (!slide.title.trim()) {
        issues.push(`${label}: 타이틀을 입력해 주세요.`);
      }
      if (!slide.subtitle.trim()) {
        issues.push(`${label}: 부제를 입력해 주세요.`);
      }
      if (!slide.href.trim()) {
        issues.push(`${label}: 연결 페이지를 입력해 주세요.`);
      }
      if (!slide.imageAlt.trim()) {
        issues.push(`${label}: 이미지 대체 텍스트를 입력해 주세요.`);
      }
      if (slide.source === "database" && !slide.hasImageFile) {
        issues.push(`${label}: 이미지를 업로드해 주세요.`);
      }
      if (slide.audiences.length === 0) {
        issues.push(`${label}: 노출 대상을 하나 이상 선택해 주세요.`);
      }
    });
    return issues;
  }, [slides]);

  const editableCount = slides.filter((slide) => slide.source === "database").length;
  const canEdit = editableCount > 0;
  const canSave =
    slides.length > 0 &&
    slides.every((slide) => slide.source === "database") &&
    validationErrors.length === 0;

  function registerFileInput(id: string, element: HTMLInputElement | null) {
    fileInputRefs.current.set(id, element);
  }

  function replacePreviewUrl(id: string, nextUrl: string) {
    const previous = previewUrlRefs.current.get(id);
    if (previous && previous !== nextUrl && previous.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
    }
    previewUrlRefs.current.set(id, nextUrl);
  }

  function updateSlide(id: string, updater: (slide: SlideDraft) => SlideDraft) {
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id !== id) {
          return slide;
        }
        const nextSlide = updater(slide);
        if (nextSlide.imageSrc !== slide.imageSrc) {
          replacePreviewUrl(id, nextSlide.imageSrc);
        }
        return nextSlide;
      }),
    );
  }

  function addSlide() {
    const id = crypto.randomUUID();
    const fallback = createPlaceholderImage("새 광고 카드");
    setSlides((current) => [
      ...current,
      {
        id,
        title: "",
        subtitle: "",
        imageSrc: fallback,
        hasImageFile: false,
        imageAlt: "",
        href: "",
        isActive: true,
        audiences: [...DEFAULT_PROMOTION_AUDIENCES],
        allowedCampuses: [],
        source: "database",
      },
    ]);
  }

  function moveSlide(id: string, direction: -1 | 1) {
    setSlides((current) => {
      const index = current.findIndex((slide) => slide.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (!removed) {
        return current;
      }
      next.splice(nextIndex, 0, removed);
      return next;
    });
  }

  function removeSlide(id: string) {
    if (pendingCrop?.slideId === id) {
      URL.revokeObjectURL(pendingCrop.sourceUrl);
      setPendingCrop(null);
    }
    setSlides((current) => {
      const next = current.filter((slide) => slide.id !== id);
      const removedUrl = previewUrlRefs.current.get(id);
      if (removedUrl && removedUrl.startsWith("blob:")) {
        URL.revokeObjectURL(removedUrl);
      }
      previewUrlRefs.current.delete(id);
      fileInputRefs.current.delete(id);
      return next;
    });
  }

  function onFileChange(id: string, file: File | null) {
    if (!file) {
      return;
    }
    if (!isImageFile(file)) {
      setError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    const sourceUrl = URL.createObjectURL(file);
    setPendingCrop({ slideId: id, sourceUrl });
  }

  function applyCroppedImage(file: File) {
    if (!pendingCrop) {
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    replacePreviewUrl(pendingCrop.slideId, nextUrl);
    const input = fileInputRefs.current.get(pendingCrop.slideId) ?? null;
    setInputFiles(input, [file]);
    setSlides((current) =>
      current.map((slide) =>
        slide.id === pendingCrop.slideId
          ? {
              ...slide,
              imageSrc: nextUrl,
              hasImageFile: true,
              imageAlt: slide.imageAlt || slide.title || "광고 카드 이미지",
            }
          : slide,
      ),
    );
    URL.revokeObjectURL(pendingCrop.sourceUrl);
    setPendingCrop(null);
    setError(null);
  }

  function handleImageUpload(id: string) {
    setError(null);
    fileInputRefs.current.get(id)?.click();
  }

  function closeCrop() {
    if (pendingCrop) {
      URL.revokeObjectURL(pendingCrop.sourceUrl);
      const input = fileInputRefs.current.get(pendingCrop.slideId) ?? null;
      if (input) {
        input.value = "";
      }
    }
    setPendingCrop(null);
  }

  function isEditable(slide: SlideDraft) {
    return slide.source === "database";
  }

  return (
    <div className="grid gap-6">
      <Card tone="elevated" className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-kicker">Preview</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">홈 캐러셀 미리보기</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              드래프트가 바로 반영되며, 저장 전까지는 로컬에서만 보입니다.
            </p>
          </div>
          <Button href="/" variant="secondary" className="w-full sm:w-auto">
            홈에서 보기
          </Button>
        </div>
        <PromotionCarousel slides={previewSlides} className="mt-0" />
      </Card>

      <form ref={formRef} action={saveAction} className="grid gap-6">
        <input type="hidden" name="slidesJson" value={serializedSlides} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-kicker">Editor</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">광고 카드 편집</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              순서, 노출 권한, 문구, 이미지 편집을 한 화면에서 처리합니다.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={addSlide}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="size-4" />
            카드 추가
          </Button>
        </div>

        {error ? <FormMessage variant="error">{error}</FormMessage> : null}
        {validationErrors.length > 0 ? (
          <FormMessage variant="info">
            저장 전 확인이 필요한 항목이 {validationErrors.length}개 있습니다. 첫 번째 항목:{" "}
            {validationErrors[0]}
          </FormMessage>
        ) : null}
        {!canEdit ? (
          <FormMessage variant="info">
            현재 로드된 카드가 모두 미리보기용이라 기존 카드 수정은 막혀 있습니다. 새 카드는 추가할 수 있습니다.
          </FormMessage>
        ) : null}

        <section className="grid gap-4" aria-label="광고 카드 목록">
          {slides.map((slide, index) => {
            const previewSrc = slide.imageSrc || createPlaceholderImage(slide.title);
            const editable = isEditable(slide);
            const titleInvalid = !slide.title.trim();
            const subtitleInvalid = !slide.subtitle.trim();
            const hrefInvalid = !slide.href.trim();
            const altInvalid = !slide.imageAlt.trim();
            const audienceInvalid = slide.audiences.length === 0;
            return (
              <Card key={slide.id} tone="default" className="grid gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SlideBadge>순번 {index + 1}</SlideBadge>
                      <SlideBadge active={slide.isActive}>{slide.isActive ? "활성" : "비활성"}</SlideBadge>
                      <SlideBadge muted>{editable ? "DB" : "Catalog"}</SlideBadge>
                      {slide.audiences.map((audience) => (
                        <SlideBadge key={audience} muted>
                          {getAudienceLabel(audience)}
                        </SlideBadge>
                      ))}
                      {slide.allowedCampuses.length > 0 ? (
                        <SlideBadge muted>
                          {slide.allowedCampuses
                            .map((campus) => CAMPUS_DIRECTORY.find((item) => item.slug === campus)?.label ?? campus)
                            .join(", ")}
                        </SlideBadge>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2">
                      <Input
                        value={slide.title}
                        onChange={(event) =>
                          updateSlide(slide.id, (current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="카드 타이틀"
                        disabled={!editable}
                        className={titleInvalid ? "border-danger/40 bg-danger/5 focus:border-danger" : undefined}
                      />
                      <Textarea
                        value={slide.subtitle}
                        onChange={(event) =>
                          updateSlide(slide.id, (current) => ({ ...current, subtitle: event.target.value }))
                        }
                        placeholder="카드 부제"
                        rows={3}
                        disabled={!editable}
                        className={subtitleInvalid ? "border-danger/40 bg-danger/5 focus:border-danger" : undefined}
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
                      onClick={() => moveSlide(slide.id, -1)}
                    >
                      <ArrowUpIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === slides.length - 1 || !editable}
                      ariaLabel="아래로 이동"
                      title="아래로 이동"
                      onClick={() => moveSlide(slide.id, 1)}
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
                      onClick={() => removeSlide(slide.id)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                  <div className="grid gap-3">
                    <div className="relative aspect-[21/9] overflow-hidden rounded-panel border border-border/70 bg-surface-inset">
                      {/* eslint-disable-next-line @next/next/no-img-element -- live preview can use blob/object URLs */}
                      <img
                        src={previewSrc}
                        alt={slide.imageAlt || slide.title || "광고 카드 이미지"}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!editable}
                        onClick={() => handleImageUpload(slide.id)}
                      >
                        <PhotoIcon className="size-4" />
                        이미지 업로드
                      </Button>
                      <Input
                        value={slide.imageAlt}
                        onChange={(event) =>
                          updateSlide(slide.id, (current) => ({ ...current, imageAlt: event.target.value }))
                        }
                        placeholder="이미지 대체 텍스트"
                        disabled={!editable}
                        className={cn("min-w-0", altInvalid ? "border-danger/40 bg-danger/5 focus:border-danger" : null)}
                      />
                      <input
                        ref={(element) => registerFileInput(slide.id, element)}
                        type="file"
                        accept="image/*"
                        name={getFileInputName(slide.id)}
                        className="hidden"
                        onChange={(event) => onFileChange(slide.id, event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <p className="text-xs leading-6 text-muted-foreground">
                      21:9 이미지를 업로드한 뒤 팝업에서 위치를 조정하면 캐러셀에서 즉시 반영됩니다.
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-panel border border-border/70 bg-surface-inset p-4">
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      연결 페이지
                      <Input
                        value={slide.href}
                        onChange={(event) =>
                          updateSlide(slide.id, (current) => ({ ...current, href: event.target.value }))
                        }
                        placeholder="/events/signup-reward"
                        disabled={!editable}
                        className={hrefInvalid ? "border-danger/40 bg-danger/5 focus:border-danger" : undefined}
                      />
                    </label>

                    <div className="grid gap-3">
                      <label className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-surface px-3 py-2.5 text-sm font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          <CheckIcon className="size-4 text-muted-foreground" />
                          활성 여부
                        </span>
                        <input
                          type="checkbox"
                          checked={slide.isActive}
                          onChange={(event) =>
                            updateSlide(slide.id, (current) => ({ ...current, isActive: event.target.checked }))
                          }
                          className="h-4 w-4 accent-primary"
                          disabled={!editable}
                        />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium text-foreground">노출 대상</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          로그인 여부와 허용 기수를 통합해 대상군별로 선택합니다.
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PROMOTION_AUDIENCE_OPTIONS.map((option) => {
                          const checked = slide.audiences.includes(option.key);
                          return (
                            <label
                              key={option.key}
                              className={cn(
                                "grid gap-1 rounded-[1rem] border px-3 py-2 text-sm transition-colors",
                                checked
                                  ? "border-primary/20 bg-primary-soft/50 text-foreground"
                                  : "border-border/70 bg-surface text-foreground",
                              )}
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    updateSlide(slide.id, (current) => ({
                                      ...current,
                                      audiences: toggleAudience(current.audiences, option.key, event.target.checked),
                                    }))
                                  }
                                  className="h-4 w-4 accent-primary"
                                  disabled={!editable}
                                />
                                {option.label}
                              </span>
                              <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
                            </label>
                          );
                        })}
                      </div>
                      {audienceInvalid ? (
                        <p className="text-xs font-medium text-danger">노출 대상을 하나 이상 선택해 주세요.</p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <p className="text-sm font-medium text-foreground">허용 캠퍼스</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {CAMPUS_DIRECTORY.map((campus) => {
                          const checked = slide.allowedCampuses.includes(campus.slug);
                          return (
                            <label
                              key={campus.slug}
                              className="flex items-center gap-2 rounded-[1rem] border border-border/70 bg-surface px-3 py-2 text-sm text-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  updateSlide(slide.id, (current) => ({
                                    ...current,
                                    allowedCampuses: event.target.checked
                                      ? [...current.allowedCampuses, campus.slug]
                                      : current.allowedCampuses.filter((item) => item !== campus.slug),
                                  }))
                                }
                                className="h-4 w-4 accent-primary"
                                disabled={!editable}
                              />
                              {campus.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        <div className="fixed bottom-safe-bottom-5 left-5 z-40 md:left-auto md:right-[5.5rem]">
          <Button
            type="submit"
            variant="primary"
            className="rounded-full px-6 shadow-floating"
            disabled={!canSave}
          >
            저장
          </Button>
        </div>
      </form>

      <MediaCropModal
        open={Boolean(pendingCrop)}
        title="광고 이미지 편집"
        subtitle="21:9 비율 가이드에 맞춰 이미지를 조정합니다."
        aspectRatio={PROMOTION_ASPECT_RATIO}
        sourceUrl={pendingCrop?.sourceUrl ?? ""}
        outputName={`${pendingCrop?.slideId ?? "promotion"}-slide.webp`}
        onCancel={closeCrop}
        onApply={applyCroppedImage}
      />
    </div>
  );
}
