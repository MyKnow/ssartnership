import {
  DEFAULT_PROMOTION_AUDIENCES,
  EVENT_CAMPAIGNS,
  HOME_PROMOTIONS,
  type EventCampaign,
  type EventCondition,
  type EventConditionKey,
  type PromotionAudience,
  type PromotionSlide,
} from "@/lib/promotions/catalog";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";
import { getSsafyMemberLifecycle, SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PromotionEventRow = {
  id: string;
  slug: string;
  title: string;
  short_title: string;
  description: string;
  period_label: string;
  starts_at: string;
  ends_at: string;
  hero_image_src: string;
  hero_image_alt: string;
  conditions: unknown;
  rules: unknown;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type PromotionSlideRow = {
  id: string;
  display_order: number;
  title: string;
  subtitle: string;
  image_src: string;
  image_alt: string;
  href: string;
  is_active: boolean | null;
  audiences: unknown;
  allowed_campuses: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type ManagedEventCampaign = EventCampaign & {
  id: string | null;
  isActive: boolean;
  source: "database" | "catalog";
  createdAt: string | null;
  updatedAt: string | null;
};

export type ManagedPromotionSlide = PromotionSlide & {
  source: "database" | "catalog";
  displayOrder: number;
  subtitle: string;
  isActive: boolean;
  audiences: PromotionAudience[];
  allowedCampuses: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

const conditionKeys = new Set<EventConditionKey>([
  "signup",
  "mm",
  "push",
  "marketing",
  "review",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeCondition(value: unknown): EventCondition | null {
  if (!isRecord(value)) {
    return null;
  }
  const key = typeof value.key === "string" ? value.key : "";
  if (!conditionKeys.has(key as EventConditionKey)) {
    return null;
  }
  const tickets = Number(value.tickets);
  return {
    key: key as EventConditionKey,
    title: typeof value.title === "string" ? value.title : "",
    description: typeof value.description === "string" ? value.description : "",
    tickets: Number.isFinite(tickets) ? Math.max(0, Math.round(tickets)) : 0,
    ctaHref: typeof value.ctaHref === "string" ? value.ctaHref : "/",
    ctaLabel: typeof value.ctaLabel === "string" ? value.ctaLabel : "이동",
    repeatable: value.repeatable === true,
  };
}

function normalizeConditions(value: unknown): EventCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeCondition(item))
    .filter((item): item is EventCondition => Boolean(item));
}

function normalizeRules(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function mapStaticCampaign(campaign: EventCampaign): ManagedEventCampaign {
  return {
    ...campaign,
    id: null,
    isActive: true,
    source: "catalog",
    createdAt: null,
    updatedAt: null,
  };
}

function mapStaticSlide(slide: PromotionSlide, index: number): ManagedPromotionSlide {
  return {
    ...slide,
    source: "catalog",
    displayOrder: index + 1,
    subtitle: slide.description,
    isActive: true,
    audiences: normalizePromotionAudiences(slide.audiences),
    allowedCampuses: slide.allowedCampuses ?? [],
    createdAt: null,
    updatedAt: null,
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeAudienceArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  const valid = new Set<PromotionAudience>(DEFAULT_PROMOTION_AUDIENCES);
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is PromotionAudience => valid.has(item as PromotionAudience));
}

function normalizePromotionAudiences(value: unknown) {
  const audiences = normalizeAudienceArray(value);
  return audiences.length > 0 ? audiences : [...DEFAULT_PROMOTION_AUDIENCES];
}

function normalizeCampusValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const bySlug = CAMPUS_DIRECTORY.find((campus) => campus.slug === trimmed);
  if (bySlug) {
    return bySlug.slug;
  }
  const byLabel = CAMPUS_DIRECTORY.find(
    (campus) => campus.label === trimmed || campus.fullLabel === trimmed,
  );
  return byLabel?.slug ?? trimmed;
}

function mapRow(row: PromotionEventRow): ManagedEventCampaign {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortTitle: row.short_title,
    description: row.description,
    periodLabel: row.period_label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    heroImageSrc: row.hero_image_src,
    heroImageAlt: row.hero_image_alt,
    conditions: normalizeConditions(row.conditions),
    rules: normalizeRules(row.rules),
    isActive: row.is_active !== false,
    source: "database",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSlideRow(row: PromotionSlideRow): ManagedPromotionSlide {
  return {
    id: row.id,
    title: row.title,
    description: row.subtitle,
    imageSrc: row.image_src,
    imageAlt: row.image_alt,
    href: row.href,
    source: "database",
    displayOrder: row.display_order,
    subtitle: row.subtitle,
    isActive: row.is_active !== false,
    audiences: normalizePromotionAudiences(row.audiences),
    allowedCampuses: normalizeStringArray(row.allowed_campuses),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canUseSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function staticCampaigns() {
  return EVENT_CAMPAIGNS.map((campaign) => mapStaticCampaign(campaign));
}

function staticSlides() {
  return HOME_PROMOTIONS.map((slide, index) => mapStaticSlide(slide, index));
}

export async function listManagedPromotionSlides(options?: {
  includeInactive?: boolean;
}): Promise<ManagedPromotionSlide[]> {
  if (!canUseSupabase()) {
    return staticSlides();
  }

  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("promotion_slides")
      .select(
        "id,display_order,title,subtitle,image_src,image_alt,href,is_active,audiences,allowed_campuses,created_at,updated_at",
      )
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!options?.includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[promotions] promotion_slides query failed", error.message);
      return staticSlides();
    }
    const slides = ((data ?? []) as PromotionSlideRow[]).map((row) => mapSlideRow(row));
    return slides;
  } catch (error) {
    console.error("[promotions] promotion_slides fallback", error);
    return staticSlides();
  }
}

export type PromotionSlideViewer = {
  authenticated: boolean;
  year?: number | null;
  campus?: string | null;
};

export function canViewPromotionSlide(
  slide: ManagedPromotionSlide,
  viewer: PromotionSlideViewer,
) {
  const lifecycle = typeof viewer.year === "number" ? getSsafyMemberLifecycle(viewer.year) : null;
  const viewerAudience: PromotionAudience = !viewer.authenticated
    ? "guest"
    : lifecycle?.kind === "staff" || viewer.year === SSAFY_STAFF_YEAR
      ? "staff"
      : lifecycle?.kind === "student"
        ? "student"
        : "graduate";
  if (!slide.audiences.includes(viewerAudience)) {
    return false;
  }
  if (slide.allowedCampuses.length > 0) {
    const campus = normalizeCampusValue(viewer.campus);
    if (!campus || !slide.allowedCampuses.includes(campus)) {
      return false;
    }
  }
  return true;
}

export async function listManagedEventCampaigns(options?: {
  includeInactive?: boolean;
}): Promise<ManagedEventCampaign[]> {
  if (!canUseSupabase()) {
    return staticCampaigns();
  }

  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("promotion_events")
      .select(
        "id,slug,title,short_title,description,period_label,starts_at,ends_at,hero_image_src,hero_image_alt,conditions,rules,is_active,created_at,updated_at",
      )
      .order("starts_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (!options?.includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[promotions] promotion_events query failed", error.message);
      return staticCampaigns();
    }
    const campaigns = ((data ?? []) as PromotionEventRow[]).map((row) => mapRow(row));
    return campaigns.length > 0 ? campaigns : staticCampaigns();
  } catch (error) {
    console.error("[promotions] promotion_events fallback", error);
    return staticCampaigns();
  }
}

export async function getManagedEventCampaign(slug: string) {
  const campaigns = await listManagedEventCampaigns({ includeInactive: false });
  return campaigns.find((campaign) => campaign.slug === slug) ?? null;
}

export async function getHomePromotionSlides(
  viewer: PromotionSlideViewer = { authenticated: false, year: null, campus: null },
): Promise<PromotionSlide[]> {
  const slides = await listManagedPromotionSlides({ includeInactive: false });
  return slides
    .filter((slide) => canViewPromotionSlide(slide, viewer))
    .map((slide) => ({
      id: slide.id,
      title: slide.title,
      description: slide.subtitle,
      imageSrc: slide.imageSrc,
      imageAlt: slide.imageAlt,
      href: slide.href,
      audiences: slide.audiences,
      allowedCampuses: slide.allowedCampuses,
    }));
}
