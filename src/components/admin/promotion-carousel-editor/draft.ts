import type { ImageUploadDraftFile } from "@/lib/image-upload/draft.client";
import { CAMPUS_DIRECTORY, type CampusSlug } from "@/lib/campuses";
import {
  DEFAULT_PROMOTION_AUDIENCES,
  type PromotionAudience,
} from "@/lib/promotions/catalog";

export const PROMOTION_CAROUSEL_DRAFT_KEY = "promotion-carousel-editor";
const DRAFT_VALUE_KEY = "promotionSlides";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_AUDIENCES = new Set<PromotionAudience>(DEFAULT_PROMOTION_AUDIENCES);
const VALID_CAMPUSES = new Set<CampusSlug>(CAMPUS_DIRECTORY.map((campus) => campus.slug));

export type PromotionCarouselDraftSlide = {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  hasImageFile: boolean;
  imageFile?: File;
  uploadId?: string;
  imageAlt: string;
  href: string;
  isActive: boolean;
  audiences: PromotionAudience[];
  allowedCampuses: CampusSlug[];
  eventSlug: string | null;
  adCampaignId: string | null;
  sponsorLabel: string;
  source: "database" | "catalog";
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  const normalized = asString(value).trim();
  return normalized || null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asAudiences(value: unknown) {
  return asStringArray(value).filter(
    (item): item is PromotionAudience => VALID_AUDIENCES.has(item as PromotionAudience),
  );
}

function asCampusSlugs(value: unknown) {
  return asStringArray(value).filter(
    (item): item is CampusSlug => VALID_CAMPUSES.has(item as CampusSlug),
  );
}

function getPersistableImageSrc(value: string) {
  const normalized = value.trim();
  return normalized.startsWith("blob:") || normalized.startsWith("data:")
    ? ""
    : normalized;
}

export function serializePromotionCarouselDraft(slides: PromotionCarouselDraftSlide[]) {
  return JSON.stringify(
    slides.map((slide) => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle,
      imageSrc: getPersistableImageSrc(slide.imageSrc),
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
      source: slide.source,
    })),
  );
}

export function readPromotionCarouselDraft(value: unknown): PromotionCarouselDraftSlide[] | null {
  if (typeof value !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const ids = new Set<string>();
  const slides: PromotionCarouselDraftSlide[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const id = asString(record.id).trim();
    const uploadId = asNullableString(record.uploadId);
    const source = record.source === "catalog" ? "catalog" : "database";
    if (!id || ids.has(id) || (uploadId && !UUID_PATTERN.test(uploadId))) return null;
    ids.add(id);
    slides.push({
      id,
      title: asString(record.title),
      subtitle: asString(record.subtitle),
      imageSrc: getPersistableImageSrc(asString(record.imageSrc)),
      hasImageFile: record.hasImageFile === true || Boolean(uploadId),
      ...(uploadId ? { uploadId } : {}),
      imageAlt: asString(record.imageAlt),
      href: asString(record.href),
      isActive: record.isActive === true,
      audiences: asAudiences(record.audiences),
      allowedCampuses: asCampusSlugs(record.allowedCampuses),
      eventSlug: asNullableString(record.eventSlug),
      adCampaignId: asNullableString(record.adCampaignId),
      sponsorLabel: asString(record.sponsorLabel),
      source,
    });
  }
  return slides;
}

export function getPromotionCarouselDraftFiles(
  slides: PromotionCarouselDraftSlide[],
): ImageUploadDraftFile[] {
  return slides.flatMap((slide, order) => slide.imageFile
    ? [{
        clientId: slide.id,
        role: "slide",
        order,
        file: slide.imageFile,
        ...(slide.uploadId ? { uploadId: slide.uploadId } : {}),
      }]
    : []);
}

export function getPromotionCarouselDraftValueKey() {
  return DRAFT_VALUE_KEY;
}
