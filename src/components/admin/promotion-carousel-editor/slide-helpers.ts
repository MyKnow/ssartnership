import { CAMPUS_DIRECTORY, type CampusSlug } from "@/lib/campuses";
import {
  DEFAULT_PROMOTION_AUDIENCES,
  PROMOTION_AUDIENCE_OPTIONS,
  type PromotionAudience,
} from "@/lib/promotions/catalog";
import type { ManagedPromotionSlide } from "@/lib/promotions/events";
import type { PromotionSlideField } from "@/lib/promotions/slide-validation";
import type { PromotionCarouselDraftSlide } from "./draft";

export const PROMOTION_ASPECT_RATIO = 21 / 9;

export type SlideDraft = PromotionCarouselDraftSlide;

export type PendingCrop = {
  slideId: string;
  sourceUrl: string;
  sourceFile: File;
};

export type PromotionEventPageOption = {
  href: string;
  slug: string;
  label: string;
};

export type PromotionAdCampaignOption = {
  id: string;
  label: string;
};

export type SlideUpdater = (slide: SlideDraft) => SlideDraft;

export function createPlaceholderImage(title: string) {
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

export function normalizeCampusSlug(value: string) {
  const direct = CAMPUS_DIRECTORY.find((item) => item.slug === value);
  if (direct) {
    return direct.slug;
  }
  const fallback = CAMPUS_DIRECTORY.find(
    (item) => item.label === value || item.fullLabel === value,
  );
  return fallback?.slug ?? value;
}

export function toDraftSlide(slide: ManagedPromotionSlide): SlideDraft {
  const allowedCampuses = slide.allowedCampuses
    .map((campus) => normalizeCampusSlug(campus))
    .filter((campus): campus is CampusSlug =>
      Boolean(CAMPUS_DIRECTORY.find((item) => item.slug === campus)),
    );

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
      slide.audiences.length > 0
        ? [...slide.audiences]
        : [...DEFAULT_PROMOTION_AUDIENCES],
    allowedCampuses,
    eventSlug: slide.eventSlug,
    adCampaignId: slide.adCampaignId,
    sponsorLabel: slide.sponsorLabel,
    source: slide.source,
  };
}

export function createEmptySlideDraft(id: string): SlideDraft {
  return {
    id,
    title: "",
    subtitle: "",
    imageSrc: createPlaceholderImage("새 광고 카드"),
    hasImageFile: false,
    imageAlt: "",
    href: "",
    isActive: true,
    audiences: [...DEFAULT_PROMOTION_AUDIENCES],
    allowedCampuses: [],
    eventSlug: null,
    adCampaignId: null,
    sponsorLabel: "",
    source: "database",
  };
}

export function extractEventSlugFromHref(href: string) {
  const match = href
    .trim()
    .match(/^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

export function getAudienceLabel(value: PromotionAudience) {
  return (
    PROMOTION_AUDIENCE_OPTIONS.find((item) => item.key === value)?.label ??
    value
  );
}

export function getCampusLabels(campuses: readonly string[]) {
  return campuses
    .map(
      (campus) =>
        CAMPUS_DIRECTORY.find((item) => item.slug === campus)?.label ?? campus,
    )
    .join(", ");
}

export function toggleAudience(
  audiences: PromotionAudience[],
  key: PromotionAudience,
  checked: boolean,
) {
  if (checked) {
    return audiences.includes(key) ? audiences : [...audiences, key];
  }
  return audiences.filter((item) => item !== key);
}

export function toggleCampus(
  campuses: CampusSlug[],
  slug: CampusSlug,
  checked: boolean,
) {
  return checked
    ? [...campuses, slug]
    : campuses.filter((item) => item !== slug);
}

export function moveSlideInList(
  slides: SlideDraft[],
  id: string,
  direction: -1 | 1,
) {
  const index = slides.findIndex((slide) => slide.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= slides.length) {
    return slides;
  }
  const next = [...slides];
  const [removed] = next.splice(index, 1);
  if (!removed) {
    return slides;
  }
  next.splice(nextIndex, 0, removed);
  return next;
}

export function promotionSlideFieldId(slideId: string, field: PromotionSlideField) {
  return `promotion-slide-${slideId}-${field}`;
}

export function buildPromotionPreviewSlides(slides: readonly SlideDraft[]) {
  return slides
    .filter((slide) => slide.isActive && slide.imageSrc)
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
      adCampaignId: slide.adCampaignId,
      sponsorLabel: slide.sponsorLabel,
    }));
}

export function serializePromotionSlidesForSubmit(slides: readonly SlideDraft[]) {
  return JSON.stringify(
    slides.map((slide) => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle,
      imageSrc: slide.imageSrc,
      hasImageFile: slide.hasImageFile,
      uploadId: slide.uploadId ?? null,
      imageAlt: slide.imageAlt,
      href: slide.href,
      isActive: slide.isActive,
      audiences: slide.audiences,
      allowedCampuses: slide.allowedCampuses,
      eventSlug: slide.eventSlug,
      adCampaignId: slide.adCampaignId,
      sponsorLabel: slide.sponsorLabel,
    })),
  );
}

export function collectPendingSlideUploads(slides: readonly SlideDraft[]) {
  return slides.flatMap((slide) =>
    slide.imageFile && !slide.uploadId
      ? [{ clientId: slide.id, role: "slide" as const, file: slide.imageFile }]
      : [],
  );
}
