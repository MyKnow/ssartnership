import { getSupabaseAdminClient } from "@/lib/supabase/server";

type CategoryOption = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
  slug: string;
};

function emptyReadModel() {
  return {
    categories: [] as CategoryOption[],
    companies: [] as CompanyOption[],
    loadError: true,
  };
}

/**
 * Shared options for partner creation and editing. The route provides a
 * trusted campus scope; this model keeps query details and safe recovery out
 * of the form page.
 */
export async function getAdminPartnerFormOptionsReadModel({
  managedCampusSlugs,
}: {
  managedCampusSlugs: readonly string[] | null;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    let companiesQuery = supabase
      .from("partner_companies")
      .select("id,name,slug")
      .order("name", { ascending: true });
    if (managedCampusSlugs) {
      companiesQuery = companiesQuery.overlaps("managed_campus_slugs", [
        ...managedCampusSlugs,
      ]);
    }

    const [categoriesResult, companiesResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id,key,label,description,color")
        .order("created_at", { ascending: true }),
      companiesQuery,
    ]);
    if (categoriesResult.error || companiesResult.error) {
      return emptyReadModel();
    }

    return {
      categories: (categoriesResult.data ?? []) as CategoryOption[],
      companies: (companiesResult.data ?? []) as CompanyOption[],
      loadError: false,
    };
  } catch {
    return emptyReadModel();
  }
}
