import { permanentRedirect, redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerCreateToast from "@/components/admin/AdminPartnerCreateToast";
import AdminPartnerManager from "@/components/admin/AdminPartnerManager";
import AdminCompanyPlanManager from "@/components/admin/AdminCompanyPlanManager";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatsRow from "@/components/ui/StatsRow";
import InlineMessage from "@/components/ui/InlineMessage";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
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
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveAdminPartnerTabRedirect } from "@/lib/admin-ia";
import { canAdmin } from "@/lib/admin-permissions";
import {
  getManagedCampusFilterValues,
  isRegionalAdminAccount,
} from "@/lib/admin-scope";

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
  managed_campus_slugs?: string[] | null;
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
  const adminSession = await requireAdminPermission("brands", "read", { path: "/admin/partners" });
  const supabase = getSupabaseAdminClient();
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const canManageGlobalSections = !isRegionalAdminAccount(adminSession.account);
  const params = (await searchParams) ?? {};
  const partnerFormError = params.error ? adminPartnersErrorMessages[params.error] : null;
  const legacyTabRedirect = resolveAdminPartnerTabRedirect(params.tab);
  if (legacyTabRedirect) {
    permanentRedirect(legacyTabRedirect);
  }
  const showPlans = params.tab === "plans" && canManageGlobalSections;
  const canCreatePartner = canAdmin(
    adminSession.account.permissions,
    "brands",
    "create",
  );
  if (params.tab === "plans" && !canManageGlobalSections) {
    redirect("/admin/partners");
  }
  let partnersQuery = supabase
    .from("partners")
    .select("id,name,category_id,company_id,location,campus_slugs,managed_campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,plan_tier,plan_started_at,plan_expires_at,plan_updated_at,conditions,benefits,applies_to,images,tags,visibility,benefit_visibility,company:partner_companies(id,name,slug,description,is_active,managed_campus_slugs)")
    .order("created_at", { ascending: false });
  if (managedCampusFilter) {
    partnersQuery = partnersQuery.overlaps("managed_campus_slugs", managedCampusFilter);
  }

  const [categoriesResult, partnersResult, planRequestsResult, planEventsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    partnersQuery,
    showPlans
      ? supabase
      .from("partner_plan_upgrade_requests")
      .select(
        "id,partner_id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_at,created_at,brand:partners!partner_plan_upgrade_requests_partner_id_fkey(id,name),company:partner_companies(id,name,slug),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50)
      : Promise.resolve({ data: [], error: null }),
    showPlans
      ? supabase
      .from("partner_brand_plan_events")
      .select("id,partner_id,company_id,previous_plan_tier,next_plan_tier,source,note,created_at,brand:partners(id,name)")
      .order("created_at", { ascending: false })
      .limit(100)
      : Promise.resolve({ data: [], error: null }),
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
  const scopedPartnerIds = new Set(normalizedPartners.map((partner) => partner.id));
  const scopedCompanyIds = new Set(
    normalizedPartners
      .map((partner) => partner.company_id ?? partner.company?.id ?? null)
      .filter((companyId): companyId is string => Boolean(companyId)),
  );
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
  const mappedPlanRequests = ((planRequestsResult.data ?? []) as PartnerPlanUpgradeRequestRow[])
    .filter((request) => {
      if (!managedCampusFilter) {
        return true;
      }
      return (
        (request.partner_id ? scopedPartnerIds.has(request.partner_id) : false) ||
        scopedCompanyIds.has(request.company_id)
      );
    })
    .map((request) => {
    const brand = normalizeRelation(request.brand);
    const company = normalizeRelation(request.company);
    const requestedBy = normalizeRelation(request.requested_by);
    return {
      id: request.id,
      partnerId: request.partner_id ?? brand?.id ?? "",
      brandName: brand?.name ?? "미지정 제휴처",
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
  const planEvents = ((planEventsResult.data ?? []) as PartnerPlanEventRow[])
    .filter((event) => {
      if (!managedCampusFilter) {
        return true;
      }
      return (
        (event.partner_id ? scopedPartnerIds.has(event.partner_id) : false) ||
        scopedCompanyIds.has(event.company_id)
      );
    })
    .map((event) => {
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
      title={showPlans ? "플랜/과금" : "제휴처"}
      backHref="/admin"
      backLabel="관리 홈"
    >
      <section className="grid gap-6">
        <AdminPartnerCreateToast />
        <AdminPageHeader
          eyebrow="Partner Brands"
          title={showPlans ? "플랜과 과금 관리" : "제휴처 목록"}
          description={
            showPlans
              ? "제휴처별 플랜, 결제 요청, 변경 이력을 관리합니다."
              : "사용자에게 노출되는 제휴처의 혜택과 공개 상태를 검색하고 상세 화면에서 수정합니다."
          }
          actions={
            showPlans ? (
              <Button variant="secondary" href="/admin/partners">
                제휴처 목록
              </Button>
            ) : (
              <>
                <Button variant="secondary" href="/admin/partner-requests">
                  변경 요청
                </Button>
                {canManageGlobalSections ? (
                  <Button variant="secondary" href="/admin/categories">
                    카테고리
                  </Button>
                ) : null}
                {canCreatePartner ? (
                  <Button variant="soft" href="/admin/partners/new">
                    제휴처 추가
                  </Button>
                ) : null}
              </>
            )
          }
        />
        <StatsRow
          items={[
            { label: "제휴처", value: `${normalizedPartners.length.toLocaleString()}개`, hint: "현재 등록된 노출 단위" },
            { label: "카테고리", value: `${safeCategories.length.toLocaleString()}개`, hint: "운영 중인 분류 체계" },
            { label: "공개/대외비", value: `${publicCount.toLocaleString()} · ${confidentialCount.toLocaleString()}`, hint: "public · confidential" },
            { label: "비공개", value: `${privateCount.toLocaleString()}개`, hint: "사용자 화면 비노출" },
          ]}
          minItemWidth="13rem"
        />
        {partnerFormError ? (
          <FormMessage variant="error">{partnerFormError}</FormMessage>
        ) : null}
        {showPlans ? (
          <section className="grid min-w-0 gap-4">
            <AdminSectionHeading
              title="제휴처 플랜"
              description="결제 요청과 플랜 변경 이력을 같은 기준으로 확인합니다."
            />
            <AdminCompanyPlanManager
              brands={planBrands}
              requests={planRequests}
              events={planEvents}
            />
          </section>
        ) : (
          <section className="grid min-w-0 gap-4">
            {partnerMetrics.warningMessage ? (
              <InlineMessage
                tone="warning"
                title="제휴처 집계 일부를 불러오지 못했습니다."
                description={partnerMetrics.warningMessage}
              />
            ) : null}
            <AdminPartnerManager
              categories={safeCategories}
              canCreate={canCreatePartner}
              partners={normalizedPartners.map((partner) => ({
                ...partner,
                metrics: partnerMetrics.metricsByPartnerId.get(partner.id) ?? null,
              }))}
            />
          </section>
        )}

      </section>
    </AdminShell>
  );
}
