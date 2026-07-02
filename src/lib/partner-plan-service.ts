import {
  getPartnerCompanyPlanDefinition,
  normalizePartnerCompanyPlanTier,
  resolvePartnerBrandPlanWindow,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import {
  assertPartnerPlanUpgradeTransition,
  normalizePartnerPlanUpgradeRequestStatus,
  normalizePlanUpgradeAmount,
  normalizePlanUpgradeMemo,
  normalizePlanUpgradePayerName,
  normalizeRequestedPlanTier,
  type PartnerPlanUpgradeRequestStatus,
} from "@/lib/partner-plan-upgrades";
import {
  createAdminOperationalNotification,
  createPartnerOperationalNotification,
} from "@/lib/operational-notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type PartnerBrandPlanRecord = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  location: string;
  visibility: string;
  periodStart: string | null;
  periodEnd: string | null;
  planTier: PartnerCompanyPlanTier;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  planUpdatedAt: string | null;
};

export type PartnerPlanUpgradeRequestRecord = {
  id: string;
  partnerId: string;
  brandName: string;
  companyId: string;
  companyName: string;
  requestedByAccountId: string;
  requestedByDisplayName: string | null;
  currentPlanTier: PartnerCompanyPlanTier;
  requestedPlanTier: PartnerCompanyPlanTier;
  status: PartnerPlanUpgradeRequestStatus;
  paymentAmountKrw: number;
  payerName: string;
  memo: string;
  adminNote: string;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerBrandPlanEventRecord = {
  id: string;
  partnerId: string;
  brandName: string | null;
  companyId: string;
  previousPlanTier: PartnerCompanyPlanTier | null;
  nextPlanTier: PartnerCompanyPlanTier;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  createdAt: string;
};

export type PartnerPlanPortalData = {
  brands: PartnerBrandPlanRecord[];
  requests: PartnerPlanUpgradeRequestRecord[];
  events: PartnerBrandPlanEventRecord[];
};

type CompanyRelation = {
  id: string;
  name: string;
  slug?: string | null;
};

type BrandRow = {
  id: string;
  company_id?: string | null;
  name: string;
  location?: string | null;
  visibility?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  plan_tier?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  plan_updated_at?: string | null;
  company?: CompanyRelation | CompanyRelation[] | null;
};

type UpgradeRequestRow = {
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
  reviewed_by_admin_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  brand?: { id: string; name: string } | { id: string; name: string }[] | null;
  company?: { id: string; name: string } | { id: string; name: string }[] | null;
  requested_by?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
};

type PlanEventRow = {
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

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCompanyIds(companyIds: string[]) {
  return [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
}

function mapBrand(row: BrandRow): PartnerBrandPlanRecord {
  const company = getSingleRelation(row.company);
  const planTier = normalizePartnerCompanyPlanTier(row.plan_tier);
  const planWindow = resolvePartnerBrandPlanWindow({
    planTier,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    planStartedAt: row.plan_started_at ?? null,
    planExpiresAt: row.plan_expires_at ?? null,
  });

  return {
    id: row.id,
    name: row.name,
    companyId: row.company_id ?? company?.id ?? "",
    companyName: company?.name ?? "미지정",
    companySlug: company?.slug ?? "",
    location: row.location ?? "",
    visibility: row.visibility ?? "public",
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    planTier,
    planStartedAt: planWindow.planStartedAt,
    planExpiresAt: planWindow.planExpiresAt,
    planUpdatedAt: row.plan_updated_at ?? null,
  };
}

function mapUpgradeRequest(row: UpgradeRequestRow): PartnerPlanUpgradeRequestRecord {
  const brand = getSingleRelation(row.brand);
  const company = getSingleRelation(row.company);
  const requestedBy = getSingleRelation(row.requested_by);
  return {
    id: row.id,
    partnerId: row.partner_id ?? brand?.id ?? "",
    brandName: brand?.name ?? "미지정 브랜드",
    companyId: row.company_id,
    companyName: company?.name ?? "미지정",
    requestedByAccountId: row.requested_by_account_id,
    requestedByDisplayName: requestedBy?.display_name ?? null,
    currentPlanTier: normalizePartnerCompanyPlanTier(row.current_plan_tier),
    requestedPlanTier: normalizePartnerCompanyPlanTier(row.requested_plan_tier),
    status: normalizePartnerPlanUpgradeRequestStatus(row.status),
    paymentAmountKrw: Math.max(0, Number(row.payment_amount_krw ?? 0)),
    payerName: row.payer_name ?? "",
    memo: row.memo ?? "",
    adminNote: row.admin_note ?? "",
    reviewedByAdminId: row.reviewed_by_admin_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlanEvent(row: PlanEventRow): PartnerBrandPlanEventRecord {
  const brand = getSingleRelation(row.brand);
  return {
    id: row.id,
    partnerId: row.partner_id ?? brand?.id ?? "",
    brandName: brand?.name ?? null,
    companyId: row.company_id,
    previousPlanTier: row.previous_plan_tier
      ? normalizePartnerCompanyPlanTier(row.previous_plan_tier)
      : null,
    nextPlanTier: normalizePartnerCompanyPlanTier(row.next_plan_tier),
    source: row.source,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

export async function getPartnerPlanPortalData(
  companyIds: string[],
  accountId?: string | null,
): Promise<PartnerPlanPortalData> {
  const normalizedCompanyIds = normalizeCompanyIds(companyIds);
  if (normalizedCompanyIds.length === 0) {
    return { brands: [], requests: [], events: [] };
  }

  const supabase = getSupabaseAdminClient();
  const [brandsResult, requestsResult, eventsResult] = await Promise.all([
    supabase
      .from("partners")
      .select("id,company_id,name,location,visibility,period_start,period_end,plan_tier,plan_started_at,plan_expires_at,plan_updated_at,company:partner_companies(id,name,slug)")
      .in("company_id", normalizedCompanyIds)
      .order("name", { ascending: true }),
    supabase
      .from("partner_plan_upgrade_requests")
      .select(
        "id,partner_id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_by_admin_id,reviewed_at,created_at,updated_at,brand:partners!partner_plan_upgrade_requests_partner_id_fkey(id,name),company:partner_companies(id,name),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
      )
      .in("company_id", normalizedCompanyIds)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("partner_brand_plan_events")
      .select("id,partner_id,company_id,previous_plan_tier,next_plan_tier,source,note,created_at,brand:partners(id,name)")
      .in("company_id", normalizedCompanyIds)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (brandsResult.error) {
    throw new Error(brandsResult.error.message);
  }
  if (requestsResult.error) {
    throw new Error(requestsResult.error.message);
  }
  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const requests = ((requestsResult.data ?? []) as UpgradeRequestRow[])
    .map(mapUpgradeRequest)
    .filter((request) => !accountId || request.requestedByAccountId === accountId || normalizedCompanyIds.includes(request.companyId));

  return {
    brands: ((brandsResult.data ?? []) as BrandRow[]).map(mapBrand),
    requests,
    events: ((eventsResult.data ?? []) as PlanEventRow[]).map(mapPlanEvent),
  };
}

async function loadBrandPlanOrThrow(partnerId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partners")
    .select("id,company_id,name,location,visibility,period_start,period_end,plan_tier,plan_started_at,plan_expires_at,plan_updated_at,company:partner_companies(id,name,slug)")
    .eq("id", partnerId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("브랜드를 찾을 수 없습니다.");
  }
  return mapBrand(data as BrandRow);
}

async function assertPartnerBrandAccess(accountId: string, partnerId: string) {
  const brand = await loadBrandPlanOrThrow(partnerId);
  if (!brand.companyId) {
    throw new Error("파트너사 접근 권한이 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_account_companies")
    .select("id")
    .eq("account_id", accountId)
    .eq("company_id", brand.companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error("파트너사 접근 권한이 없습니다.");
  }

  return brand;
}

export async function createPartnerPlanUpgradeRequest(input: {
  partnerId: string;
  accountId: string;
  requestedPlanTier: string;
  paymentAmountKrw: string;
  payerName: string;
  memo: string;
}) {
  const brand = await assertPartnerBrandAccess(input.accountId, input.partnerId);
  const requestedPlanTier = normalizeRequestedPlanTier(
    input.requestedPlanTier,
    brand.planTier,
  );
  const paymentAmountKrw = normalizePlanUpgradeAmount(input.paymentAmountKrw);
  const payerName = normalizePlanUpgradePayerName(input.payerName);
  const memo = normalizePlanUpgradeMemo(input.memo);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("partner_plan_upgrade_requests")
    .insert({
      partner_id: brand.id,
      company_id: brand.companyId,
      requested_by_account_id: input.accountId,
      current_plan_tier: brand.planTier,
      requested_plan_tier: requestedPlanTier,
      payment_amount_krw: paymentAmountKrw,
      payer_name: payerName,
      memo,
    })
    .select(
      "id,partner_id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_by_admin_id,reviewed_at,created_at,updated_at,brand:partners!partner_plan_upgrade_requests_partner_id_fkey(id,name),company:partner_companies(id,name),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 처리 대기 중인 업그레이드 요청이 있습니다.");
    }
    throw new Error(error.message);
  }

  const request = mapUpgradeRequest(data as UpgradeRequestRow);
  await Promise.all([
    createAdminOperationalNotification({
      type: "partner_change_request",
      title: `${brand.name} 플랜 업그레이드 요청`,
      body: `${getPartnerCompanyPlanDefinition(brand.planTier).label}에서 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label}로 변경 요청이 접수되었습니다.`,
      targetUrl: "/admin/partners?tab=plans",
      metadata: { requestId: request.id, partnerId: brand.id, companyId: brand.companyId, requestedPlanTier },
    }).catch((error) => {
      console.error("[partner-plan-service] admin upgrade notification failed", error);
    }),
    createPartnerOperationalNotification({
      type: "plan_upgrade_requested",
      companyId: brand.companyId,
      accountIds: [input.accountId],
      title: "플랜 업그레이드 요청이 접수되었습니다",
      body: `${brand.name}의 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label} 업그레이드 요청을 관리자가 확인합니다.`,
      targetUrl: "/partner/plans",
      metadata: { requestId: request.id, partnerId: brand.id, companyId: brand.companyId, requestedPlanTier },
    }).catch((error) => {
      console.error("[partner-plan-service] partner upgrade notification failed", error);
    }),
  ]);

  return request;
}

export async function cancelPartnerPlanUpgradeRequest(input: {
  requestId: string;
  accountId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_plan_upgrade_requests")
    .select("id,requested_by_account_id,status")
    .eq("id", input.requestId)
    .maybeSingle();

  if (error || !data || data.requested_by_account_id !== input.accountId) {
    throw new Error("업그레이드 요청을 찾을 수 없습니다.");
  }
  assertPartnerPlanUpgradeTransition(
    normalizePartnerPlanUpgradeRequestStatus(data.status),
    "cancelled",
  );

  const { error: updateError } = await supabase
    .from("partner_plan_upgrade_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", input.requestId);
  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function updatePartnerBrandPlanByAdmin(input: {
  partnerId: string;
  nextPlanTier: PartnerCompanyPlanTier;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  adminId: string | null;
  note: string;
}) {
  const brand = await loadBrandPlanOrThrow(input.partnerId);
  if (!brand.companyId) {
    throw new Error("파트너사가 연결된 브랜드만 플랜을 변경할 수 있습니다.");
  }
  const now = new Date().toISOString();
  const planWindow = resolvePartnerBrandPlanWindow({
    planTier: input.nextPlanTier,
    periodStart: brand.periodStart,
    periodEnd: brand.periodEnd,
    planStartedAt: input.planStartedAt,
    planExpiresAt: input.planExpiresAt,
  });
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partners")
    .update({
      plan_tier: input.nextPlanTier,
      plan_started_at: planWindow.planStartedAt,
      plan_expires_at: planWindow.planExpiresAt,
      plan_updated_at: now,
      updated_at: now,
    })
    .eq("id", input.partnerId);
  if (error) {
    throw new Error(error.message);
  }

  const { error: eventError } = await supabase.from("partner_brand_plan_events").insert({
    partner_id: input.partnerId,
    company_id: brand.companyId,
    previous_plan_tier: brand.planTier,
    next_plan_tier: input.nextPlanTier,
    source: "admin",
    actor_admin_id: input.adminId,
    plan_started_at: planWindow.planStartedAt,
    plan_expires_at: planWindow.planExpiresAt,
    note: input.note,
  });
  if (eventError) {
    throw new Error(eventError.message);
  }

  await createPartnerOperationalNotification({
    type: "plan_changed",
    companyId: brand.companyId,
    title: `${brand.name} 플랜이 변경되었습니다`,
    body: `${getPartnerCompanyPlanDefinition(brand.planTier).label}에서 ${getPartnerCompanyPlanDefinition(input.nextPlanTier).label}로 변경되었습니다.`,
    targetUrl: "/partner/plans",
    metadata: { partnerId: input.partnerId, companyId: brand.companyId, nextPlanTier: input.nextPlanTier },
  }).catch((error) => {
    console.error("[partner-plan-service] plan change notification failed", error);
  });
}

export async function reviewPartnerPlanUpgradeRequest(input: {
  requestId: string;
  adminId: string;
  nextStatus: Extract<PartnerPlanUpgradeRequestStatus, "approved" | "rejected">;
  adminNote: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_plan_upgrade_requests")
    .select(
      "id,partner_id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_by_admin_id,reviewed_at,created_at,updated_at,brand:partners!partner_plan_upgrade_requests_partner_id_fkey(id,name),company:partner_companies(id,name),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
    )
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("업그레이드 요청을 찾을 수 없습니다.");
  }

  const request = mapUpgradeRequest(data as UpgradeRequestRow);
  if (!request.partnerId) {
    throw new Error("브랜드를 찾을 수 없습니다.");
  }
  assertPartnerPlanUpgradeTransition(request.status, input.nextStatus);
  const reviewedAt = new Date().toISOString();
  const adminNote = normalizePlanUpgradeMemo(input.adminNote);

  const { error: requestUpdateError } = await supabase
    .from("partner_plan_upgrade_requests")
    .update({
      status: input.nextStatus,
      admin_note: adminNote,
      reviewed_by_admin_id: input.adminId,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", request.id);
  if (requestUpdateError) {
    throw new Error(requestUpdateError.message);
  }

  if (input.nextStatus === "approved") {
    const planWindow = resolvePartnerBrandPlanWindow({
      planTier: request.requestedPlanTier,
      planStartedAt: reviewedAt,
      planExpiresAt: null,
    });
    const { error: brandUpdateError } = await supabase
      .from("partners")
      .update({
        plan_tier: request.requestedPlanTier,
        plan_started_at: planWindow.planStartedAt,
        plan_expires_at: planWindow.planExpiresAt,
        plan_updated_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq("id", request.partnerId);
    if (brandUpdateError) {
      throw new Error(brandUpdateError.message);
    }

    const { error: eventError } = await supabase.from("partner_brand_plan_events").insert({
      partner_id: request.partnerId,
      company_id: request.companyId,
      upgrade_request_id: request.id,
      previous_plan_tier: request.currentPlanTier,
      next_plan_tier: request.requestedPlanTier,
      source: "partner_upgrade",
      actor_admin_id: input.adminId,
      actor_partner_account_id: request.requestedByAccountId,
      plan_started_at: planWindow.planStartedAt,
      plan_expires_at: planWindow.planExpiresAt,
      note: adminNote,
    });
    if (eventError) {
      throw new Error(eventError.message);
    }
  }

  const approved = input.nextStatus === "approved";
  await createPartnerOperationalNotification({
    type: approved ? "plan_upgrade_approved" : "plan_upgrade_rejected",
    companyId: request.companyId,
    accountIds: [request.requestedByAccountId],
    title: approved ? "플랜 업그레이드가 승인되었습니다" : "플랜 업그레이드 요청이 반려되었습니다",
    body: approved
      ? `${request.brandName}의 ${getPartnerCompanyPlanDefinition(request.requestedPlanTier).label} 플랜이 적용되었습니다.`
      : `${request.brandName}의 플랜 업그레이드 요청이 반려되었습니다.${adminNote ? ` 사유: ${adminNote}` : ""}`,
    targetUrl: "/partner/plans",
    metadata: { requestId: request.id, partnerId: request.partnerId, companyId: request.companyId },
  }).catch((notificationError) => {
    console.error("[partner-plan-service] review notification failed", notificationError);
  });
}
