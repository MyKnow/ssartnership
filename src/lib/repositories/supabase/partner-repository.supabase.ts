import type { Category, Partner } from "@/lib/types";
import { cache } from "react";
import type { CampusSlug } from "@/lib/campuses";
import type {
  AdminPartnerOption,
  PartnerCategoryOption,
  PartnerRepository,
  PartnerViewContext,
  PublicPartnerSeoEntry,
  PublicPartnerSeoOptions,
} from "@/lib/repositories/partner-repository";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid, normalizeUuidList } from "@/lib/uuid";
import {
  hashPartnerPreviewToken,
  isPartnerPreviewLinkActive,
  isValidPartnerPreviewToken,
} from "@/lib/partner-preview";
import { getKstDateString } from "@/lib/partner-utils";
import { CATEGORIES_CACHE_TAG, PARTNERS_CACHE_TAG } from "@/lib/cache-tags";
import { PUBLIC_CACHE_VERSION_SNAPSHOT_SECONDS } from "@/lib/cache-ttl";
import {
  canViewPartnerDetailRow,
  mapCategoryRow,
  mapPartnerForDetail,
  mapPartnerForList,
  mapPartnerForPublicDirectory,
  mapPartnerRaw,
  mapPublicPartnerSeoEntry,
} from "./partner/mappers";
import type {
  AdminPartnerOptionRow,
  CategoryRow,
  PartnerCategoryOptionRow,
  PartnerRow,
  PublicCacheScope,
  PublicCacheVersionRow,
  PublicCacheVersionSnapshot,
  PublicPartnerSeoRow,
} from "./partner/rows";
import { logServerError } from "@/lib/server-log";

const PARTNER_SELECT_COLUMNS =
  "id,name,category_id,created_at,updated_at,location,detail_description,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,partner_benefits(id,title,max_apply_count,display_order),applies_to,images,tags,visibility,benefit_visibility,branch_scope_type,branch_scope_note,categories(key)";
const PUBLIC_DIRECTORY_SELECT_COLUMNS =
  "id,name,category_id,created_at,location,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,partner_benefits(id,title,max_apply_count,display_order),applies_to,tags,visibility,benefit_visibility,branch_scope_type,categories(key)";
const PUBLIC_PARTNER_SEO_SELECT_COLUMNS =
  "id,name,location,period_start,period_end,categories(label)";

const getCachedPublicCacheVersionSnapshot = unstable_cache(
  async (): Promise<PublicCacheVersionSnapshot> => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("public_cache_versions")
      .select("scope,version,updated_at")
      .in("scope", ["partners", "categories"]);

    if (error) {
      logServerError("[partner-repository] public cache version lookup failed", error);
      return { rows: [], lookupFailed: true };
    }

    return {
      rows: (data ?? []) as PublicCacheVersionRow[],
      lookupFailed: false,
    };
  },
  ["partner-repository", "public-cache-version-snapshot"],
  {
    revalidate: PUBLIC_CACHE_VERSION_SNAPSHOT_SECONDS,
    tags: [PARTNERS_CACHE_TAG, CATEGORIES_CACHE_TAG],
  },
);

const getPublicCacheVersionSnapshot = cache(() =>
  getCachedPublicCacheVersionSnapshot(),
);

const getPublicCacheVersionKeyByScopeKey = cache(async (scopeKey: string) => {
  const scopes = scopeKey.split(",").filter((value): value is PublicCacheScope =>
    value === "partners" || value === "categories",
  );
  const snapshot = await getPublicCacheVersionSnapshot();
  if (snapshot.lookupFailed) {
    return scopes.map((scope) => `${scope}:legacy`).join("|");
  }

  const rowsByScope = new Map(snapshot.rows.map((row) => [row.scope, row]));

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
    tags: [CATEGORIES_CACHE_TAG],
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
    tags: [PARTNERS_CACHE_TAG],
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
    tags: [PARTNERS_CACHE_TAG],
  },
);

const getCachedPartnerRowsForCampus = unstable_cache(
  async (versionKey: string, campusSlug: CampusSlug): Promise<PartnerRow[]> => {
    void versionKey;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(PARTNER_SELECT_COLUMNS)
      .contains("campus_slugs", [campusSlug])
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PartnerRow[];
  },
  ["partner-repository", "partners", "campus", "versioned"],
  {
    revalidate: false,
    tags: [PARTNERS_CACHE_TAG],
  },
);

const getCachedPublicDirectoryPartnerRowsForCampus = unstable_cache(
  async (versionKey: string, campusSlug: CampusSlug): Promise<PartnerRow[]> => {
    void versionKey;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(PUBLIC_DIRECTORY_SELECT_COLUMNS)
      .contains("campus_slugs", [campusSlug])
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PartnerRow[];
  },
  ["partner-repository", "partners", "public-directory", "campus", "versioned"],
  {
    revalidate: false,
    tags: [PARTNERS_CACHE_TAG],
  },
);

const getCachedPublicPartnerSeoRows = unstable_cache(
  async (
    versionKey: string,
    activeDate: string,
    limit: number | null,
  ): Promise<PublicPartnerSeoRow[]> => {
    void versionKey;
    const supabase = getSupabaseAdminClient();
    const baseQuery = supabase
      .from("partners")
      .select(PUBLIC_PARTNER_SEO_SELECT_COLUMNS)
      .eq("visibility", "public")
      .or(`period_start.is.null,period_start.lte.${activeDate}`)
      .or(`period_end.is.null,period_end.gte.${activeDate}`)
      .order("created_at", { ascending: false });
    const query = limit === null ? baseQuery : baseQuery.limit(limit);
    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PublicPartnerSeoRow[];
  },
  ["partner-repository", "partners", "public-seo", "versioned"],
  {
    revalidate: false,
    tags: [PARTNERS_CACHE_TAG],
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
    tags: [PARTNERS_CACHE_TAG],
  },
);

async function getPartnerRow(id: string) {
  const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
  return getCachedPartnerRowById(id, versionKey);
}

async function hasValidPreviewToken(id: string, token: string) {
  if (!isUuid(id) || !isValidPartnerPreviewToken(token)) {
    return false;
  }

  // `partner_preview_tokens.expires_at` is not null since 20260830215837, so
  // there is no missing-column retry: a schema error surfaces instead of
  // silently accepting tokens without an expiry check.
  const nowIso = new Date().toISOString();
  const { data, error } = await getSupabaseAdminClient()
    .from("partner_preview_tokens")
    .select("partner_id,created_at,expires_at")
    .eq("partner_id", id)
    .eq("token_hash", hashPartnerPreviewToken(token))
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(
    data &&
      isPartnerPreviewLinkActive(
        data.expires_at,
        new Date(nowIso),
        data.created_at ?? null,
      ),
  );
}

export class SupabasePartnerRepository implements PartnerRepository {
  async listAdminPartnerOptions(): Promise<AdminPartnerOption[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select("id,name")
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as AdminPartnerOptionRow[];
  }

  async getCategoryOptions(): Promise<PartnerCategoryOption[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from("categories")
      .select("id,key,label")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as PartnerCategoryOptionRow[]).map((row) => ({
      id: row.id,
      key: row.key ?? "",
      label: row.label ?? "",
    }));
  }

  async getCategories(): Promise<Category[]> {
    const versionKey = await getPublicCacheVersionKey(["categories"]);
    const data = await getCachedCategories(versionKey);
    return data.map(mapCategoryRow);
  }

  async getPartners(
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const rows = await getCachedPartnerRows(versionKey);
    return rows.map((item) => mapPartnerForList(item, context));
  }

  async getPartnersForCampus(
    campusSlug: CampusSlug,
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const rows = await getCachedPartnerRowsForCampus(versionKey, campusSlug);
    return rows.map((item) => mapPartnerForList(item, context));
  }

  async getPublicDirectoryPartners(
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const rows = await getCachedPublicDirectoryPartnerRows(versionKey);
    return rows.map((item) => mapPartnerForPublicDirectory(item, context));
  }

  async getPublicDirectoryPartnersForCampus(
    campusSlug: CampusSlug,
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const rows = await getCachedPublicDirectoryPartnerRowsForCampus(
      versionKey,
      campusSlug,
    );
    return rows.map((item) => mapPartnerForPublicDirectory(item, context));
  }

  async getPublicPartnerSeoEntries(
    options: PublicPartnerSeoOptions = {},
  ): Promise<PublicPartnerSeoEntry[]> {
    const versionKey = await getPublicCacheVersionKey(["partners", "categories"]);
    const activeDate = getKstDateString();
    const limit =
      Number.isSafeInteger(options.limit) && (options.limit ?? -1) >= 0
        ? (options.limit ?? null)
        : null;
    const rows = await getCachedPublicPartnerSeoRows(
      versionKey,
      activeDate,
      limit,
    );
    return rows.map(mapPublicPartnerSeoEntry);
  }

  async getHomeStateAuthorizedPartnerIds(ids: string[]): Promise<string[]> {
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

    if (!previewToken && !canViewPartnerDetailRow(row, context)) {
      return null;
    }

    return mapPartnerForDetail(row, context);
  }

  async getPartnerByIdRaw(id: string): Promise<Partner | null> {
    const row = await getPartnerRow(id);
    if (!row) {
      return null;
    }
    return mapPartnerRaw(row);
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
