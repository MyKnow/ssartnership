import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerCreateToast from "@/components/admin/AdminPartnerCreateToast";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import AdminPartnerWorkspace from "@/components/admin/AdminPartnerWorkspace";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import {
  createCategory,
  approvePartnerChangeRequest,
  deleteCategory,
  rejectPartnerChangeRequest,
  updateCategory,
} from "@/app/admin/(protected)/actions";
import { listPartnerChangeRequests } from "@/lib/partner-change-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const adminPartnersErrorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizePartnerCompany(
  value: unknown,
): PartnerCompanyRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    const first = value[0] as PartnerCompanyRow | undefined;
    return first ?? null;
  }
  if (typeof value === "object") {
    return value as PartnerCompanyRow;
  }
  return null;
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const partnerFormError = params.error ? adminPartnersErrorMessages[params.error] : null;

  const [
    categoriesResult,
    partnersResult,
    changeRequests,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("id,name,category_id,company_id,location,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,company:partner_companies(id,name,slug,description,is_active)")
      .order("created_at", { ascending: false }),
    listPartnerChangeRequests(),
  ]);

  const safeCategories = categoriesResult.data ?? [];
  const normalizedPartners = (partnersResult.data ?? []).map((partner) => ({
    ...partner,
    company: normalizePartnerCompany((partner as { company?: unknown }).company),
  }));
  const partnerMetrics = await getAdminPartnerMetrics(
    normalizedPartners.map((partner) => partner.id),
  );
  const publicCount = normalizedPartners.filter((partner) => partner.visibility === "public").length;
  const confidentialCount = normalizedPartners.filter((partner) => partner.visibility === "confidential").length;
  const privateCount = normalizedPartners.filter((partner) => partner.visibility === "private").length;

  return (
    <AdminShell
      title="브랜드 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <section className="grid gap-6">
        <AdminPartnerCreateToast />
        <ShellHeader
          eyebrow="Partners"
          title="브랜드와 변경 요청 관리"
          description="카테고리, 브랜드, 승인 대기 요청을 같은 디자인 규칙 아래에서 관리합니다."
          actions={<Button variant="soft" href="/admin/partners/new">브랜드 추가</Button>}
        />
        <StatsRow
          items={[
            { label: "브랜드", value: `${normalizedPartners.length.toLocaleString()}개`, hint: "현재 등록된 전체 브랜드" },
            { label: "카테고리", value: `${safeCategories.length.toLocaleString()}개`, hint: "운영 중인 분류 체계" },
            { label: "공개/대외비", value: `${publicCount.toLocaleString()} · ${confidentialCount.toLocaleString()}`, hint: "public · confidential" },
            { label: "비공개/요청", value: `${privateCount.toLocaleString()}개`, hint: `승인 대기 ${changeRequests.length.toLocaleString()}건` },
          ]}
          minItemWidth="13rem"
        />
        {partnerFormError ? (
          <FormMessage variant="error">{partnerFormError}</FormMessage>
        ) : null}
        <AdminPartnerWorkspace
          categories={safeCategories}
          partners={normalizedPartners}
          changeRequests={changeRequests}
          partnerMetrics={partnerMetrics}
          approveAction={approvePartnerChangeRequest}
          rejectAction={rejectPartnerChangeRequest}
          createCategoryAction={createCategory}
          updateCategoryAction={updateCategory}
          deleteCategoryAction={deleteCategory}
        />

      </section>
    </AdminShell>
  );
}
