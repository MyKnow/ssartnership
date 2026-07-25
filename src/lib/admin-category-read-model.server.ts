import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminCategoryReadModelCategory = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
};

function emptyReadModel() {
  return {
    categories: [] as AdminCategoryReadModelCategory[],
    usageCountById: {} as Record<string, number>,
    loadError: true,
  };
}

/**
 * Category-management read model. One projected partner query replaces the
 * former per-category count fan-out while keeping the page free of storage
 * errors and query details.
 */
export async function getAdminCategoryReadModel() {
  try {
    const supabase = getSupabaseAdminClient();
    const categoriesResult = await supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true });
    if (categoriesResult.error) {
      return emptyReadModel();
    }

    const categories = (categoriesResult.data ?? []) as AdminCategoryReadModelCategory[];
    const categoryIds = categories.map((category) => category.id);
    if (categoryIds.length === 0) {
      return {
        categories,
        usageCountById: {},
        loadError: false,
      };
    }

    const partnerUsageResult = await supabase
      .from("partners")
      .select("category_id")
      .in("category_id", categoryIds);
    if (partnerUsageResult.error) {
      return emptyReadModel();
    }

    const usageCountById = Object.fromEntries(
      categoryIds.map((categoryId) => [categoryId, 0]),
    ) as Record<string, number>;
    for (const partner of partnerUsageResult.data ?? []) {
      const categoryId = partner.category_id;
      if (categoryId && categoryId in usageCountById) {
        usageCountById[categoryId] += 1;
      }
    }

    return {
      categories,
      usageCountById,
      loadError: false,
    };
  } catch {
    return emptyReadModel();
  }
}
