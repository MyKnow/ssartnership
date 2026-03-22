import type { Category, Partner } from "@/lib/types";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";
import { getSupabasePublicClient } from "@/lib/supabase/server";

function normalizeDate(value: string | null) {
  return value ?? "미정";
}

function extractCategoryKey(categories: unknown) {
  if (!categories) {
    return undefined;
  }
  if (Array.isArray(categories)) {
    return categories[0]?.key as string | undefined;
  }
  if (typeof categories === "object" && categories !== null) {
    return (categories as { key?: string }).key;
  }
  return undefined;
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

  async getPartners(): Promise<Partner[]> {
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase
      .from("partners")
      .select(
        "id,name,location,map_url,contact,period_start,period_end,benefits,conditions,tags,categories!inner(key)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (
      data?.map((item) => {
        const categoryKey = extractCategoryKey(item.categories) ?? "health";
        return {
          id: item.id,
          name: item.name,
          category: categoryKey,
          location: item.location,
          mapUrl: item.map_url ?? undefined,
          contact: item.contact,
          period: {
            start: normalizeDate(item.period_start),
            end: normalizeDate(item.period_end),
          },
          benefits: item.benefits ?? [],
          conditions: item.conditions ?? [],
          tags: item.tags ?? [],
        };
      }) ?? []
    );
  }

  async getPartnerById(id: string): Promise<Partner | null> {
    if (!id) {
      return null;
    }
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase
      .from("partners")
      .select(
        "id,category_id,name,location,map_url,contact,period_start,period_end,benefits,conditions,tags"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    let categoryKey = "health";
    if (data.category_id) {
      const { data: categoryData } = await supabase
        .from("categories")
        .select("key")
        .eq("id", data.category_id)
        .maybeSingle();
      if (categoryData?.key) {
        categoryKey = categoryData.key;
      }
    }
    return {
      id: data.id,
      name: data.name,
      category: categoryKey,
      location: data.location,
      mapUrl: data.map_url ?? undefined,
      contact: data.contact,
      period: {
        start: normalizeDate(data.period_start),
        end: normalizeDate(data.period_end),
      },
      benefits: data.benefits ?? [],
      conditions: data.conditions ?? [],
      tags: data.tags ?? [],
    };
  }
}
