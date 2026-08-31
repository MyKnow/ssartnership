import type { Category, Partner } from "@/lib/types";
import { normalizePartnerBenefitItems } from "@/lib/partner-benefit-items";
import { cache } from "react";
import {
  getPartnerAudienceLabel,
  normalizePartnerAudience,
} from "@/lib/partner-audience";
import { normalizeCampusSlugs } from "@/lib/campuses";
import { normalizePartnerBenefitActionType } from "@/lib/partner-benefit-action";
import type {
  PartnerRepository,
  PartnerViewContext,
} from "@/lib/repositories/partner-repository";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  canViewPartnerDetails,
  normalizePartnerVisibility,
} from "@/lib/partner-visibility";
import {
  maskPartnerBenefitsForAccess,
  normalizePartnerBenefitVisibility,
} from "@/lib/partner-benefit-visibility";
import { isUuid, normalizeUuidList } from "@/lib/uuid";
import {
  hashPartnerPreviewToken,
  isMissingPartnerPreviewExpiryColumnError,
  isPartnerPreviewLinkActive,
  isValidPartnerPreviewToken,
} from "@/lib/partner-preview";

type PartnerRow = {
  id: string;
  name: string;
  category_id: string;
  created_at: string;
  updated_at?: string | null;
  location: string;
  detail_description?: string | null;
  campus_slugs?: string[] | null;
  thumbnail?: string | null;
  map_url?: string | null;
  benefit_action_type?: string | null;
  benefit_action_link?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  partner_benefits?: Array<{
    id: string;
    title: string;
    max_apply_count: number | null;
    display_order?: number | null;
  }> | null;
  applies_to?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility?: string | null;
  benefit_visibility?: string | null;
  branch_scope_type?: string | null;
  branch_scope_note?: string | null;
  categories?: { key?: string | null } | Array<{ key?: string | null }> | null;
};

type CategoryRow = {
  key?: string | null;
  label?: string | null;
  description?: string | null;
  color?: string | null;
};

type PublicCacheScope = "partners" | "categories";

type PublicCacheVersionRow = {
  scope: string;
  version: number | string | null;
  updated_at: string | null;
};

const PARTNER_SELECT_COLUMNS =
  "id,name,category_id,created_at,updated_at,location,detail_description,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,partner_benefits(id,title,max_apply_count,display_order),applies_to,images,tags,visibility,benefit_visibility,branch_scope_type,branch_scope_note,categories(key)";
const PUBLIC_DIRECTORY_SELECT_COLUMNS =
  "id,name,category_id,created_at,location,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,tags,visibility,benefit_visibility,branch_scope_type,categories(key)";

function normalizeDate(value: string | null | undefined) {
  return value ?? "미정";
}

function extractCategoryKey(categories: PartnerRow["categories"]) {
  if (!categories) {
    return undefined;
  }
  if (Array.isArray(categories)) {
    return categories[0]?.key ?? undefined;
  }
  if (typeof categories === "object") {
    return categories.key ?? undefined;
  }
  return undefined;
}

const getPublicCacheVersionKeyByScopeKey = cache(async (scopeKey: string) => {
  const scopes = scopeKey.split(",").filter((value): value is PublicCacheScope =>
    value === "partners" || value === "categories",
  );
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_cache_versions")
    .select("scope,version,updated_at")
    .in("scope", scopes);

  if (error) {
    console.error(
      "[partner-repository] public cache version lookup failed",
      error.message,
    );
    return scopes.map((scope) => `${scope}:legacy`).join("|");
  }

  const rowsByScope = new Map(
    ((data ?? []) as PublicCacheVersionRow[]).map((row) => [row.scope, row]),
  );

  return scopes
    .map((scope) => {
      const row = rowsByScope.get(scope);
      return `${scope}:${row?.version ?? "0"}:${row?.updated_at ?? "missing"}`;
    })
    .join("|");
});

async function getPublicCacheVersionKey(scopes: PublicCacheScope[]) {
  const normalizedScopes = [...new Set(scopes)].sort();
  return getPublicCacheVersionKeyByScopeKey(normalizedScopes.join(","));
}

const getCachedCategories = unstable_cache(
  async (versionKey: string): Promise<CategoryRow[]> => {
    void versionKey;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("categories")
      .select("key,label,description,color")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as CategoryRow[];
  },
  ["partner-repository", "categories", "versioned"],
  {
    revalidate: false,
    tags: ["categories"],
  },
);

const getCachedPartnerRows = unstable_cache(
  async (versionKey: string): Promise<PartnerRow[]> => {
    void versionKey;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(PARTNER_SELECT_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PartnerRow[];
  },
  ["partner-repository", "partners", "versioned"],
  {
    revalidate: false,
    tags: ["partners"],
  },
);

const getCachedPublicDirectoryPartnerRows = unstable_cache(
  async (versionKey: string): Promise<PartnerRow[]> => {
    void versionKey;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(PUBLIC_DIRECTORY_SELECT_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PartnerRow[];
  },
  ["partner-repository", "partners", "public-directory", "versioned"],
  {
    revalidate: false,
    tags: ["partners"],
  },
);

const getCachedPartnerRowById = unstable_cache(
  async (id: string, versionKey: string): Promise<PartnerRow | null> => {
    void versionKey;
    if (!id || !isUuid(id)) {
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(PARTNER_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    return data as PartnerRow;
  },
  ["partner-repository", "partner-by-id", "versioned"],
  {
    revalidate: false,
    tags: ["partners"],
  },
);

function toVisiblePartner(row: PartnerRow, categoryKey: string): Partner {
  const galleryImages = row.images ?? [];
  const thumbnail = row.thumbnail ?? row.images?.[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    benefitVisibility: normalizePartnerBenefitVisibility(row.benefit_visibility),
    createdAt: row.created_at,
    location: row.location,
    detailDescription: row.detail_description ?? null,
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    thumbnail,
    mapUrl: row.map_url ?? undefined,
    benefitActionType: normalizePartnerBenefitActionType(
      row.benefit_action_type,
      row.benefit_action_link || row.reservation_link ? "external_link" : "none",
    ),
    benefitActionLink: row.benefit_action_link ?? undefined,
    benefitItems: row.partner_benefits?.length
      ? row.partner_benefits
          .slice()
          .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
          .map((benefit) => ({
            id: benefit.id,
            title: benefit.title,
            maxApplyCount: benefit.max_apply_count,
            displayOrder: benefit.display_order ?? undefined,
          }))
      : normalizePartnerBenefitItems((row.benefits ?? []).map((title, index) => ({
          id: `legacy-benefit-${row.id}-${index + 1}`,
          title,
        }))),
    reservationLink: row.reservation_link ?? undefined,
    inquiryLink: row.inquiry_link ?? undefined,
    period: {
      start: normalizeDate(row.period_start),
      end: normalizeDate(row.period_end),
    },
    conditions: row.conditions ?? [],
    benefits: row.benefits ?? [],
    appliesTo: normalizePartnerAudience(row.applies_to),
    images: galleryImages,
    tags: row.tags ?? [],
    branchScopeType: row.branch_scope_type ?? "single_location",
    branchScopeNote: row.branch_scope_note ?? null,
  };
}

function toLockedPartner(row: PartnerRow, categoryKey: string): Partner {
  return {
    id: row.id,
    name: "",
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    benefitVisibility: normalizePartnerBenefitVisibility(row.benefit_visibility),
    createdAt: row.created_at,
    location: "",
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    period: {
      start: "",
      end: "",
    },
    conditions: [],
    benefits: [],
    appliesTo: normalizePartnerAudience(row.applies_to),
    thumbnail: null,
    images: [],
    tags: [],
  };
}

function toVisiblePublicDirectoryPartner(row: PartnerRow, categoryKey: string): Partner {
  const appliesTo = normalizePartnerAudience(row.applies_to);
  return {
    id: row.id,
    name: row.name,
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    benefitVisibility: normalizePartnerBenefitVisibility(row.benefit_visibility),
    createdAt: row.created_at,
    location: row.location,
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    thumbnail: row.thumbnail ?? null,
    mapUrl: row.map_url ?? undefined,
    benefitActionType: normalizePartnerBenefitActionType(
      row.benefit_action_type,
      row.benefit_action_link || row.reservation_link ? "external_link" : "none",
    ),
    benefitActionLink: row.benefit_action_link ?? undefined,
    reservationLink: row.reservation_link ?? undefined,
    inquiryLink: row.inquiry_link ?? undefined,
    period: {
      start: normalizeDate(row.period_start),
      end: normalizeDate(row.period_end),
    },
    conditions: [],
    benefits: [],
    benefitItems: [],
    appliesTo,
    images: [],
    tags: row.tags ?? [],
    directorySearchText: [
      row.name,
      row.location,
      row.reservation_link ?? "",
      row.inquiry_link ?? "",
      (row.conditions ?? []).join(" "),
      (row.benefits ?? []).join(" "),
      appliesTo.map((item) => getPartnerAudienceLabel(item)).join(" "),
      (row.tags ?? []).join(" "),
    ]
      .join(" ")
      .toLowerCase(),
    branchScopeType: row.branch_scope_type ?? "single_location",
  };
}

function mapPartnerForList(
  row: PartnerRow,
  context: PartnerViewContext,
): Partner {
  const categoryKey = extractCategoryKey(row.categories) ?? "health";
  const visibility = normalizePartnerVisibility(row.visibility);
  if (canViewPartnerDetails(visibility, context.authenticated)) {
    return maskPartnerBenefitsForAccess(toVisiblePartner(row, categoryKey), context);
  }
  return toLockedPartner(row, categoryKey);
}

function mapPartnerForPublicDirectory(
  row: PartnerRow,
  context: PartnerViewContext,
): Partner {
  const categoryKey = extractCategoryKey(row.categories) ?? "health";
  const visibility = normalizePartnerVisibility(row.visibility);
  if (canViewPartnerDetails(visibility, context.authenticated)) {
    return maskPartnerBenefitsForAccess(
      toVisiblePublicDirectoryPartner(row, categoryKey),
      context,
    );
  }
  return toLockedPartner(row, categoryKey);
}

async function getPartnerRow(id: string) {
  const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
  return getCachedPartnerRowById(id, versionKey);
}

async function hasValidPreviewToken(id: string, token: string) {
  if (!isUuid(id) || !isValidPartnerPreviewToken(token)) {
    return false;
  }

  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  let { data, error } = await supabase
    .from("partner_preview_tokens")
    .select("partner_id,created_at,expires_at")
    .eq("partner_id", id)
    .eq("token_hash", hashPartnerPreviewToken(token))
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error && isMissingPartnerPreviewExpiryColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("partner_preview_tokens")
      .select("partner_id,created_at")
      .eq("partner_id", id)
      .eq("token_hash", hashPartnerPreviewToken(token))
      .maybeSingle());
  }

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(
    data &&
      isPartnerPreviewLinkActive(
        "expires_at" in data ? data.expires_at : null,
        new Date(nowIso),
        data.created_at ?? null,
      ),
  );
}

export class SupabasePartnerRepository implements PartnerRepository {
  async getCategories(): Promise<Category[]> {
    const versionKey = await getPublicCacheVersionKey(["categories"]);
    const data = await getCachedCategories(versionKey);
    return data.map((item) => ({
      key: item.key ?? "",
      label: item.label ?? "",
      description: item.description ?? "",
      color: item.color ?? undefined,
    }));
  }

  async getPartners(
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const rows = await getCachedPartnerRows(versionKey);
    return rows.map((item) => mapPartnerForList(item, context));
  }

  async getPublicDirectoryPartners(
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const rows = await getCachedPublicDirectoryPartnerRows(versionKey);
    return rows.map((item) => mapPartnerForPublicDirectory(item, context));
  }

  async getHomeStateAuthorizedPartnerIds(
    ids: string[],
    context: PartnerViewContext = { authenticated: false },
  ): Promise<string[]> {
    void context;
    const normalizedIds = normalizeUuidList(ids);
    if (normalizedIds.length === 0) {
      return [];
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select("id")
      .in("id", normalizedIds);

    if (error) {
      throw new Error(error.message);
    }

    const existingIds = new Set(
      (data ?? []).map((row) => (row as { id: string }).id),
    );
    return normalizedIds.filter((id) => existingIds.has(id));
  }

  async getPartnerById(
    id: string,
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner | null> {
    const previewToken = context.previewToken?.trim() || null;
    if (previewToken && !(await hasValidPreviewToken(id, previewToken))) {
      return null;
    }

    const row = await getPartnerRow(id);
    if (!row) {
      return null;
    }

    const visibility = normalizePartnerVisibility(row.visibility);
    if (!previewToken) {
      if (visibility === "private") {
        return null;
      }
      if (visibility === "confidential" && !context.authenticated) {
        return null;
      }

      if (
        !canViewPartnerDetails(
          visibility,
          context.authenticated,
          {
            start: row.period_start,
            end: row.period_end,
          },
        )
      ) {
        return null;
      }
    }

    const categoryKey = extractCategoryKey(row.categories) ?? "health";
    return maskPartnerBenefitsForAccess(toVisiblePartner(row, categoryKey), context);
  }

  async getPartnerByIdRaw(id: string): Promise<Partner | null> {
    const row = await getPartnerRow(id);
    if (!row) {
      return null;
    }
    const categoryKey = extractCategoryKey(row.categories) ?? "health";
    return toVisiblePartner(row, categoryKey);
  }

  async partnerExists(id: string): Promise<boolean> {
    if (!id || !isUuid(id)) {
      return false;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data);
  }
}
