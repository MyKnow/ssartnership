import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerNewView from "@/components/admin/AdminPartnerNewView";
import { createPartnerFormAction } from "@/app/admin/(protected)/actions";
import { parseAdminPartnerXlsxFileAction } from "@/app/admin/(protected)/partners/new/actions";
import { requireAdminPermission } from "@/lib/admin-access";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { CAMPUS_SLUGS } from "@/lib/campuses";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizePartnerCompanies(value: unknown): PartnerCompanyRow[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as PartnerCompanyRow[];
  }
  if (typeof value === "object") {
    return [value as PartnerCompanyRow];
  }
  return [];
}

export default async function AdminPartnerNewPage() {
  const adminSession = await requireAdminPermission("brands", "create", {
    path: "/admin/partners/new",
  });
  const supabase = getSupabaseAdminClient();
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  let companiesQuery = supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active,managed_campus_slugs,created_at,updated_at")
    .order("name", { ascending: true });
  if (managedCampusFilter) {
    companiesQuery = companiesQuery.overlaps("managed_campus_slugs", managedCampusFilter);
  }

  const [categoriesResult, companiesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    companiesQuery,
  ]);

  const categories = categoriesResult.data ?? [];
  const companies = normalizePartnerCompanies(companiesResult.data).map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
  }));
  const defaultCategoryId = categories[0]?.id ?? "";
  const defaultCampusSlugs =
    managedCampusFilter ?? [...CAMPUS_SLUGS];

  return (
    <AdminShell
      title="제휴처 추가"
      backHref="/admin/partners"
      backLabel="제휴처"
    >
      <AdminPartnerNewView
        partner={{
          name: "",
          visibility: "public",
          benefitVisibility: "public",
          location: "",
          detailDescription: "",
          campusSlugs: defaultCampusSlugs,
          mapUrl: "",
          benefitActionType: "none",
          benefitActionLink: "",
          reservationLink: "",
          inquiryLink: "",
          period: { start: "", end: "" },
          conditions: [],
          benefits: [],
          appliesTo: [],
          thumbnail: null,
          images: [],
          tags: [],
          company: null,
        }}
        categoryOptions={categories.map((category) => ({
          id: category.id,
          key: category.key,
          label: category.label,
        }))}
        companyOptions={companies}
        categoryId={defaultCategoryId}
        createAction={createPartnerFormAction}
        parseFileAction={parseAdminPartnerXlsxFileAction}
      />
    </AdminShell>
  );
}
