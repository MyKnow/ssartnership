import type { Category, Partner } from "@/lib/types";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("categories")
      .select("key,label,description")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (
      data?.map((item) => ({
        key: item.key,
        label: item.label,
        description: item.description ?? "",
      })) ?? []
    );
  }

  async getPartners(): Promise<Partner[]> {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("partners")
      .select(
        "id,name,location,map_url,contact,period_start,period_end,benefits,tags,categories!inner(key)"
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
          tags: item.tags ?? [],
        };
      }) ?? []
    );
  }
}
