import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import PartnerCardForm, {
  type PartnerCardFormField,
} from "@/components/PartnerCardForm";
import { createPartner } from "@/app/admin/(protected)/actions";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const partnerFormFocusByError: Record<string, PartnerCardFormField> = {
  partner_form_missing_required: "name",
  partner_form_invalid_period: "companyDescription",
  partner_form_invalid_map_url: "mapUrl",
  partner_form_invalid_reservation_url: "reservationLink",
  partner_form_invalid_inquiry_url: "inquiryLink",
  partner_form_invalid_visibility: "name",
  partner_form_invalid_applies_to: "companyDescription",
  partner_company_missing_name: "companyName",
  partner_company_invalid_email: "companyContactEmail",
};

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

export default async function AdminPartnerNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const partnerFormError = params.error ? partnerFormErrorMessages[params.error] : null;

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
  const focusField = params.error ? partnerFormFocusByError[params.error] : undefined;

  return (
    <AdminShell
      title="브랜드 추가"
      backHref="/admin/partners"
      backLabel="브랜드 관리"
    >
      <section className="grid gap-6">

        {partnerFormError ? (
          <FormMessage variant="error">{partnerFormError}</FormMessage>
        ) : null}

        {categories.length === 0 ? (
          <Card tone="elevated">
            <EmptyState
              title="먼저 카테고리를 추가해 주세요"
              description="브랜드를 추가하려면 최소 1개의 카테고리가 필요합니다."
            />
          </Card>
        ) : (
          <PartnerCardForm
            mode="create"
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
            formAction={createPartner}
            submitLabel="브랜드 추가"
            className="mt-6"
            focusField={focusField}
            fieldErrors={focusField ? { [focusField]: partnerFormError ?? "" } : undefined}
          />
        )}
      </section>
    </AdminShell>
  );
}
