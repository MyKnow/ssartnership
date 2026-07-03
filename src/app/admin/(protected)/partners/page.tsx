import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerCreateToast from "@/components/admin/AdminPartnerCreateToast";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import AdminPartnerWorkspace from "@/components/admin/AdminPartnerWorkspace";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import {
  normalizePartnerCompanyPlanTier,
  resolvePartnerBrandPlanWindow,
} from "@/lib/partner-company-plans";
import { normalizePartnerPlanUpgradeRequestStatus } from "@/lib/partner-plan-upgrades";
import { getPartnerBillingInvoiceSummariesForUpgradeRequests } from "@/lib/partner-plan-service";
import {
  createCategory,
  approvePartnerChangeRequest,
  deleteCategory,
  rejectPartnerChangeRequest,
  updateCategory,
} from "@/app/admin/(protected)/actions";
import { listPartnerChangeRequests } from "@/lib/partner-change-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeAdminPartnerWorkspaceTab } from "@/components/admin/partner-workspace-tabs";

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

type PartnerPlanUpgradeRequestRow = {
  id: string;
  partner_id?: string | null;
  company_id: string;
  requested_by_account_id: string;
  current_plan_tier: string;
  requested_plan_tier: string;
  status: string;
  payment_amount_krw: number;
  payer_name: string;
  memo: string;
  admin_note: string;
  reviewed_at?: string | null;
  created_at: string;
  brand?: { id: string; name: string } | { id: string; name: string }[] | null;
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
  requested_by?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
};

type PartnerPlanEventRow = {
  id: string;
  partner_id?: string | null;
  company_id: string;
  previous_plan_tier?: string | null;
  next_plan_tier: string;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  created_at: string;
  brand?: { id: string; name: string } | { id: string; name: string }[] | null;
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

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; tab?: string }>;
}) {
  await requireAdminPermission("brands", "read", { path: "/admin/partners" });
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const partnerFormError = params.error ? adminPartnersErrorMessages[params.error] : null;
  const initialTab = normalizeAdminPartnerWorkspaceTab(params.tab);

  const [
    categoriesResult,
    partnersResult,
    planRequestsResult,
    planEventsResult,
    changeRequests,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("id,name,category_id,company_id,location,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,plan_tier,plan_started_at,plan_expires_at,plan_updated_at,conditions,benefits,applies_to,images,tags,visibility,benefit_visibility,company:partner_companies(id,name,slug,description,is_active)")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_plan_upgrade_requests")
      .select(
        "id,partner_id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_at,created_at,brand:partners!partner_plan_upgrade_requests_partner_id_fkey(id,name),company:partner_companies(id,name,slug),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("partner_brand_plan_events")
      .select("id,partner_id,company_id,previous_plan_tier,next_plan_tier,source,note,created_at,brand:partners(id,name)")
      .order("created_at", { ascending: false })
      .limit(100),
    listPartnerChangeRequests(),
  ]);

  if (partnersResult.error) {
    throw new Error(`partner load failed: ${partnersResult.error.message}`);
  }
  if (planRequestsResult.error) {
    throw new Error(`partner plan request load failed: ${planRequestsResult.error.message}`);
  }
  if (planEventsResult.error) {
    throw new Error(`partner plan event load failed: ${planEventsResult.error.message}`);
  }

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
  const planBrands = normalizedPartners.map((partner) => {
    const planTier = normalizePartnerCompanyPlanTier((partner as { plan_tier?: string | null }).plan_tier);
    const planWindow = resolvePartnerBrandPlanWindow({
      planTier,
      periodStart: (partner as { period_start?: string | null }).period_start ?? null,
      periodEnd: (partner as { period_end?: string | null }).period_end ?? null,
      planStartedAt: (partner as { plan_started_at?: string | null }).plan_started_at ?? null,
      planExpiresAt: (partner as { plan_expires_at?: string | null }).plan_expires_at ?? null,
    });

    return {
      id: partner.id,
      name: partner.name,
      companyId: partner.company_id ?? partner.company?.id ?? "",
      companyName: partner.company?.name ?? "미지정",
      location: partner.location,
      periodStart: partner.period_start ?? null,
      periodEnd: partner.period_end ?? null,
      planTier,
      planStartedAt: planWindow.planStartedAt,
      planExpiresAt: planWindow.planExpiresAt,
      planUpdatedAt: (partner as { plan_updated_at?: string | null }).plan_updated_at ?? null,
    };
  });
  const mappedPlanRequests = ((planRequestsResult.data ?? []) as PartnerPlanUpgradeRequestRow[]).map((request) => {
    const brand = normalizeRelation(request.brand);
    const company = normalizeRelation(request.company);
    const requestedBy = normalizeRelation(request.requested_by);
    return {
      id: request.id,
      partnerId: request.partner_id ?? brand?.id ?? "",
      brandName: brand?.name ?? "미지정 브랜드",
      companyId: request.company_id,
      companyName: company?.name ?? "미지정",
      requestedByDisplayName: requestedBy?.display_name ?? null,
      currentPlanTier: normalizePartnerCompanyPlanTier(request.current_plan_tier),
      requestedPlanTier: normalizePartnerCompanyPlanTier(request.requested_plan_tier),
      status: normalizePartnerPlanUpgradeRequestStatus(request.status),
      paymentAmountKrw: Math.max(0, Number(request.payment_amount_krw ?? 0)),
      payerName: request.payer_name ?? "",
      memo: request.memo ?? "",
      adminNote: request.admin_note ?? "",
      reviewedAt: request.reviewed_at ?? null,
      createdAt: request.created_at,
      billingInvoice: null,
    };
  });
  const billingByRequestId =
    await getPartnerBillingInvoiceSummariesForUpgradeRequests(
      mappedPlanRequests.map((request) => request.id),
    );
  const planRequests = mappedPlanRequests.map((request) => ({
    ...request,
    billingInvoice: billingByRequestId.get(request.id) ?? null,
  }));
  const planEvents = ((planEventsResult.data ?? []) as PartnerPlanEventRow[]).map((event) => {
    const brand = normalizeRelation(event.brand);
    return {
      id: event.id,
      partnerId: event.partner_id ?? brand?.id ?? "",
      brandName: brand?.name ?? null,
      companyId: event.company_id,
      previousPlanTier: event.previous_plan_tier
        ? normalizePartnerCompanyPlanTier(event.previous_plan_tier)
        : null,
      nextPlanTier: normalizePartnerCompanyPlanTier(event.next_plan_tier),
      source: event.source,
      note: event.note ?? "",
      createdAt: event.created_at,
    };
  });

  return (
    <AdminShell
      title="제휴처(브랜드) 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <section className="grid gap-6">
        <AdminPartnerCreateToast />
        <ShellHeader
          eyebrow="Partner Brands"
          title="제휴처와 브랜드 운영"
          description="고객에게 노출되는 제휴처 카드, 승인 대기 요청, 카테고리를 탭으로 나눠 관리합니다."
          actions={
            <>
              <Button variant="secondary" href="/admin/companies">
                파트너사/계정 관리
              </Button>
              <Button variant="soft" href="/admin/partners/new">
                제휴처 추가
              </Button>
            </>
          }
        />
        <StatsRow
          items={[
            { label: "제휴처", value: `${normalizedPartners.length.toLocaleString()}개`, hint: "현재 등록된 전체 브랜드" },
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
          planBrands={planBrands}
          planRequests={planRequests}
          planEvents={planEvents}
          partnerMetrics={partnerMetrics}
          initialTab={initialTab}
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
