import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerCreateForm from "@/components/admin/AdminPartnerCreateForm";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
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
  const supabase = getSupabaseAdminClient();

  const [categoriesResult, companiesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active,created_at,updated_at")
      .order("name", { ascending: true }),
  ]);

  const categories = categoriesResult.data ?? [];
  const companies = normalizePartnerCompanies(companiesResult.data).map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    contactName: company.contact_name ?? null,
    contactEmail: company.contact_email ?? null,
  }));
  const defaultCategoryId = categories[0]?.id ?? "";

  return (
    <AdminShell
      title="브랜드 추가"
      backHref="/admin/partners"
      backLabel="브랜드 관리"
    >
      <section className="grid gap-6">
        {categories.length === 0 ? (
          <Card tone="elevated">
            <EmptyState
              title="먼저 카테고리를 추가해 주세요"
              description="브랜드를 추가하려면 최소 1개의 카테고리가 필요합니다."
            />
          </Card>
        ) : (
          <AdminPartnerCreateForm
            partner={{
              name: "",
              visibility: "public",
              location: "",
              mapUrl: "",
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
              label: category.label,
            }))}
            companyOptions={companies}
            categoryId={defaultCategoryId}
          />
        )}
      </section>
    </AdminShell>
  );
}
