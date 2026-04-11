import type { Category, Partner } from "@/lib/types";
import {
  normalizePartnerAudience,
} from "@/lib/partner-audience";
import type {
  PartnerRepository,
  PartnerViewContext,
} from "@/lib/repositories/partner-repository";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient, getSupabasePublicClient } from "@/lib/supabase/server";
import {
  canViewPartnerDetails,
  normalizePartnerVisibility,
} from "@/lib/partner-visibility";

type PartnerRow = {
  id: string;
  name: string;
  category_id: string;
  location: string;
  thumbnail?: string | null;
  map_url?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  applies_to?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility?: string | null;
  categories?: { key?: string | null } | Array<{ key?: string | null }> | null;
};

type CategoryRow = {
  key?: string | null;
  label?: string | null;
  description?: string | null;
  color?: string | null;
};

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

const getCachedCategories = unstable_cache(
  async (): Promise<CategoryRow[]> => {
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("key,label,description,color")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as CategoryRow[];
  },
  ["partner-repository", "categories"],
  {
    revalidate: 300,
    tags: ["categories"],
  },
);

const getCachedPartnerRows = unstable_cache(
  async (): Promise<PartnerRow[]> => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(
        "id,name,category_id,location,thumbnail,map_url,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,categories(key)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PartnerRow[];
  },
  ["partner-repository", "partners"],
  {
    revalidate: 300,
    tags: ["partners"],
  },
);

const getCachedPartnerRowById = unstable_cache(
  async (id: string): Promise<PartnerRow | null> => {
    if (!id) {
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(
        "id,name,category_id,location,thumbnail,map_url,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,categories(key)",
      )
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
  ["partner-repository", "partner-by-id"],
  {
    revalidate: 300,
    tags: ["partners"],
  },
);

function toVisiblePartner(row: PartnerRow, categoryKey: string): Partner {
  const galleryImages = row.thumbnail ? row.images ?? [] : (row.images ?? []).slice(1);
  const thumbnail = row.thumbnail ?? row.images?.[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    location: row.location,
    thumbnail,
    mapUrl: row.map_url ?? undefined,
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
  };
}

function toLockedPartner(row: PartnerRow, categoryKey: string): Partner {
  return {
    id: row.id,
    name: "",
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    location: "",
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

function mapPartnerForList(
  row: PartnerRow,
  context: PartnerViewContext,
): Partner {
  const categoryKey = extractCategoryKey(row.categories) ?? "health";
  const visibility = normalizePartnerVisibility(row.visibility);
  if (canViewPartnerDetails(visibility, context.authenticated)) {
    return toVisiblePartner(row, categoryKey);
  }
  return toLockedPartner(row, categoryKey);
}

async function getPartnerRow(id: string) {
  return getCachedPartnerRowById(id);
}

export class SupabasePartnerRepository implements PartnerRepository {
  async getCategories(): Promise<Category[]> {
    const data = await getCachedCategories();
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
    const rows = await getCachedPartnerRows();
    return rows.map((item) => mapPartnerForList(item, context));
  }

  async getPartnerById(
    id: string,
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner | null> {
    const row = await getPartnerRow(id);
    if (!row) {
      return null;
    }

    const visibility = normalizePartnerVisibility(row.visibility);
    if (visibility === "private") {
      return null;
    }
    if (visibility === "confidential" && !context.authenticated) {
      return null;
    }

    const categoryKey = extractCategoryKey(row.categories) ?? "health";
    return toVisiblePartner(row, categoryKey);
  }
}
