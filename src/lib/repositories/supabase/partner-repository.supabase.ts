import type { Category, Partner } from "@/lib/types";
import type {
  PartnerRepository,
  PartnerViewContext,
} from "@/lib/repositories/partner-repository";
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
  map_url?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility?: string | null;
  categories?: { key?: string | null } | Array<{ key?: string | null }> | null;
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

function toVisiblePartner(row: PartnerRow, categoryKey: string): Partner {
  return {
    id: row.id,
    name: row.name,
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    location: row.location,
    mapUrl: row.map_url ?? undefined,
    reservationLink: row.reservation_link ?? undefined,
    inquiryLink: row.inquiry_link ?? undefined,
    period: {
      start: normalizeDate(row.period_start),
      end: normalizeDate(row.period_end),
    },
    benefits: row.benefits ?? [],
    conditions: row.conditions ?? [],
    images: row.images ?? [],
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
    benefits: [],
    conditions: [],
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
  if (!id) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partners")
    .select(
      "id,name,category_id,location,map_url,reservation_link,inquiry_link,period_start,period_end,benefits,conditions,images,tags,visibility,categories(key)",
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
}

export class SupabasePartnerRepository implements PartnerRepository {
  async getCategories(): Promise<Category[]> {
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("key,label,description,color")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (
      data?.map((item) => ({
        key: item.key,
        label: item.label,
        description: item.description ?? "",
        color: item.color ?? undefined,
      })) ?? []
    );
  }

  async getPartners(
    context: PartnerViewContext = { authenticated: false },
  ): Promise<Partner[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select(
        "id,name,category_id,location,map_url,reservation_link,inquiry_link,period_start,period_end,benefits,conditions,images,tags,visibility,categories(key)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (
      data?.map((item) =>
        mapPartnerForList(item as PartnerRow, context),
      ) ?? []
    );
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
