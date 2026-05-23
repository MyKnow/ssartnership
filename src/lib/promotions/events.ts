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
import {
  getEventPageDefinition,
} from "@/lib/event-pages";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";
import { getSsafyMemberLifecycle, SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PromotionEventRow = {
  id: string;
  slug: string;
  page_path: string | null;
  target_audiences: unknown;
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
  event_slug: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ManagedEventCampaign = EventCampaign & {
  id: string | null;
  pagePath: string;
  targetAudiences: PromotionAudience[];
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
  eventSlug: string | null;
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
    pagePath: `/events/${campaign.slug}`,
    targetAudiences: [...DEFAULT_PROMOTION_AUDIENCES],
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
    eventSlug: extractEventSlugFromHref(slide.href),
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
  const definition = getEventPageDefinition(row.slug);
  return {
    id: row.id,
    slug: row.slug,
    title: definition?.title ?? row.title,
    shortTitle: definition?.shortTitle ?? row.short_title,
    description: definition?.description ?? row.description,
    periodLabel: definition?.periodLabel ?? row.period_label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    heroImageSrc: definition?.heroImageSrc ?? row.hero_image_src,
    heroImageAlt: definition?.heroImageAlt ?? row.hero_image_alt,
    conditions: definition?.conditions ?? normalizeConditions(row.conditions),
    rules: definition?.rules ?? normalizeRules(row.rules),
    pagePath: row.page_path?.trim() || `/events/${row.slug}`,
    targetAudiences: normalizePromotionAudiences(row.target_audiences),
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
    eventSlug: row.event_slug ?? extractEventSlugFromHref(row.href),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extractEventSlugFromHref(href: string) {
  const match = href.trim().match(/^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/);
  return match?.[1] ?? null;
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
        "id,display_order,title,subtitle,image_src,image_alt,href,is_active,audiences,allowed_campuses,event_slug,created_at,updated_at",
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

export type PromotionCampaignStateKey =
  | "unregistered"
  | "inactive"
  | "upcoming"
  | "active"
  | "expired";

export type PromotionCampaignState = {
  key: PromotionCampaignStateKey;
  label: string;
  isVisible: boolean;
};

function toTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getPromotionCampaignState(
  campaign: ManagedEventCampaign | null,
  now: Date = new Date(),
): PromotionCampaignState {
  if (!campaign) {
    return {
      key: "unregistered",
      label: "등록 필요",
      isVisible: false,
    };
  }
  if (!campaign.isActive) {
    return {
      key: "inactive",
      label: "비활성",
      isVisible: false,
    };
  }

  const nowTime = now.getTime();
  const startsAt = toTime(campaign.startsAt);
  const endsAt = toTime(campaign.endsAt);
  if (startsAt !== null && nowTime < startsAt) {
    return {
      key: "upcoming",
      label: "진행 전",
      isVisible: false,
    };
  }
  if (endsAt !== null && nowTime > endsAt) {
    return {
      key: "expired",
      label: "진행 후",
      isVisible: false,
    };
  }
  return {
    key: "active",
    label: "진행 중",
    isVisible: true,
  };
}

export function isPromotionCampaignVisible(
  campaign: ManagedEventCampaign | null,
  now: Date = new Date(),
) {
  return getPromotionCampaignState(campaign, now).isVisible;
}

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
  if (viewerAudience === "guest") {
    return true;
  }
  if (slide.allowedCampuses.length > 0) {
    const campus = normalizeCampusValue(viewer.campus);
    if (!campus || !slide.allowedCampuses.includes(campus)) {
      return false;
    }
  }
  return true;
}

export function canDisplayHomePromotionSlide(
  slide: ManagedPromotionSlide,
  viewer: PromotionSlideViewer,
  campaignsBySlug: ReadonlyMap<string, ManagedEventCampaign>,
  now: Date = new Date(),
) {
  if (!slide.isActive || !canViewPromotionSlide(slide, viewer)) {
    return false;
  }
  if (!slide.eventSlug) {
    return true;
  }
  return isPromotionCampaignVisible(campaignsBySlug.get(slide.eventSlug) ?? null, now);
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
        "id,slug,page_path,target_audiences,title,short_title,description,period_label,starts_at,ends_at,hero_image_src,hero_image_alt,conditions,rules,is_active,created_at,updated_at",
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
  const campaigns = await listManagedEventCampaigns({ includeInactive: true });
  return campaigns.find((campaign) => campaign.slug === slug) ?? null;
}

export async function getHomePromotionSlides(
  viewer: PromotionSlideViewer = { authenticated: false, year: null, campus: null },
): Promise<PromotionSlide[]> {
  const [slides, campaigns] = await Promise.all([
    listManagedPromotionSlides({ includeInactive: false }),
    listManagedEventCampaigns({ includeInactive: true }),
  ]);
  const campaignsBySlug = new Map(campaigns.map((campaign) => [campaign.slug, campaign]));
  return slides
    .filter((slide) => canDisplayHomePromotionSlide(slide, viewer, campaignsBySlug))
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
