import {
  getPartnerCompanyPlanDefinition,
  normalizePartnerCompanyPlanTier,
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

export type PartnerCompanyPlanRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  planTier: PartnerCompanyPlanTier;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  planUpdatedAt: string | null;
};

export type PartnerPlanUpgradeRequestRecord = {
  id: string;
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

export type PartnerCompanyPlanEventRecord = {
  id: string;
  companyId: string;
  previousPlanTier: PartnerCompanyPlanTier | null;
  nextPlanTier: PartnerCompanyPlanTier;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  createdAt: string;
};

export type PartnerPlanPortalData = {
  companies: PartnerCompanyPlanRecord[];
  requests: PartnerPlanUpgradeRequestRecord[];
  events: PartnerCompanyPlanEventRecord[];
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  plan_tier?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  plan_updated_at?: string | null;
};

type UpgradeRequestRow = {
  id: string;
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
  company?: { id: string; name: string } | { id: string; name: string }[] | null;
  requested_by?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
};

type PlanEventRow = {
  id: string;
  company_id: string;
  previous_plan_tier?: string | null;
  next_plan_tier: string;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  created_at: string;
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

function mapCompany(row: CompanyRow): PartnerCompanyPlanRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    isActive: row.is_active !== false,
    planTier: normalizePartnerCompanyPlanTier(row.plan_tier),
    planStartedAt: row.plan_started_at ?? null,
    planExpiresAt: row.plan_expires_at ?? null,
    planUpdatedAt: row.plan_updated_at ?? null,
  };
}

function mapUpgradeRequest(row: UpgradeRequestRow): PartnerPlanUpgradeRequestRecord {
  const company = getSingleRelation(row.company);
  const requestedBy = getSingleRelation(row.requested_by);
  return {
    id: row.id,
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

function mapPlanEvent(row: PlanEventRow): PartnerCompanyPlanEventRecord {
  return {
    id: row.id,
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
    return { companies: [], requests: [], events: [] };
  }

  const supabase = getSupabaseAdminClient();
  const [companiesResult, requestsResult, eventsResult] = await Promise.all([
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,plan_tier,plan_started_at,plan_expires_at,plan_updated_at")
      .in("id", normalizedCompanyIds)
      .order("name", { ascending: true }),
    supabase
      .from("partner_plan_upgrade_requests")
      .select(
        "id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_by_admin_id,reviewed_at,created_at,updated_at,company:partner_companies(id,name),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
      )
      .in("company_id", normalizedCompanyIds)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("partner_company_plan_events")
      .select("id,company_id,previous_plan_tier,next_plan_tier,source,note,created_at")
      .in("company_id", normalizedCompanyIds)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (companiesResult.error) {
    throw new Error(companiesResult.error.message);
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
    companies: ((companiesResult.data ?? []) as CompanyRow[]).map(mapCompany),
    requests,
    events: ((eventsResult.data ?? []) as PlanEventRow[]).map(mapPlanEvent),
  };
}

async function loadCompanyPlanOrThrow(companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active,plan_tier,plan_started_at,plan_expires_at,plan_updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("파트너사를 찾을 수 없습니다.");
  }
  return mapCompany(data as CompanyRow);
}

async function assertPartnerCompanyAccess(accountId: string, companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_account_companies")
    .select("id")
    .eq("account_id", accountId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error("파트너사 접근 권한이 없습니다.");
  }
}

export async function createPartnerPlanUpgradeRequest(input: {
  companyId: string;
  accountId: string;
  requestedPlanTier: string;
  paymentAmountKrw: string;
  payerName: string;
  memo: string;
}) {
  await assertPartnerCompanyAccess(input.accountId, input.companyId);
  const company = await loadCompanyPlanOrThrow(input.companyId);
  const requestedPlanTier = normalizeRequestedPlanTier(
    input.requestedPlanTier,
    company.planTier,
  );
  const paymentAmountKrw = normalizePlanUpgradeAmount(input.paymentAmountKrw);
  const payerName = normalizePlanUpgradePayerName(input.payerName);
  const memo = normalizePlanUpgradeMemo(input.memo);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("partner_plan_upgrade_requests")
    .insert({
      company_id: company.id,
      requested_by_account_id: input.accountId,
      current_plan_tier: company.planTier,
      requested_plan_tier: requestedPlanTier,
      payment_amount_krw: paymentAmountKrw,
      payer_name: payerName,
      memo,
    })
    .select(
      "id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_by_admin_id,reviewed_at,created_at,updated_at,company:partner_companies(id,name),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
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
      title: `${company.name} 플랜 업그레이드 요청`,
      body: `${getPartnerCompanyPlanDefinition(company.planTier).label}에서 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label}로 변경 요청이 접수되었습니다.`,
      targetUrl: "/admin/companies?tab=plans",
      metadata: { requestId: request.id, companyId: company.id, requestedPlanTier },
    }).catch((error) => {
      console.error("[partner-plan-service] admin upgrade notification failed", error);
    }),
    createPartnerOperationalNotification({
      type: "plan_upgrade_requested",
      companyId: company.id,
      accountIds: [input.accountId],
      title: "플랜 업그레이드 요청이 접수되었습니다",
      body: `${company.name}의 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label} 업그레이드 요청을 관리자가 확인합니다.`,
      targetUrl: "/partner/plans",
      metadata: { requestId: request.id, companyId: company.id, requestedPlanTier },
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
    .select("id,company_id,requested_by_account_id,status")
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

export async function updatePartnerCompanyPlanByAdmin(input: {
  companyId: string;
  nextPlanTier: PartnerCompanyPlanTier;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  adminId: string | null;
  note: string;
}) {
  const company = await loadCompanyPlanOrThrow(input.companyId);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_companies")
    .update({
      plan_tier: input.nextPlanTier,
      plan_started_at: input.planStartedAt,
      plan_expires_at: input.planExpiresAt,
      plan_updated_at: now,
      updated_at: now,
    })
    .eq("id", input.companyId);
  if (error) {
    throw new Error(error.message);
  }

  const { error: eventError } = await supabase.from("partner_company_plan_events").insert({
    company_id: input.companyId,
    previous_plan_tier: company.planTier,
    next_plan_tier: input.nextPlanTier,
    source: "admin",
    actor_admin_id: input.adminId,
    plan_started_at: input.planStartedAt,
    plan_expires_at: input.planExpiresAt,
    note: input.note,
  });
  if (eventError) {
    throw new Error(eventError.message);
  }

  await createPartnerOperationalNotification({
    type: "plan_changed",
    companyId: input.companyId,
    title: `${company.name} 플랜이 변경되었습니다`,
    body: `${getPartnerCompanyPlanDefinition(company.planTier).label}에서 ${getPartnerCompanyPlanDefinition(input.nextPlanTier).label}로 변경되었습니다.`,
    targetUrl: "/partner/plans",
    metadata: { companyId: input.companyId, nextPlanTier: input.nextPlanTier },
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
      "id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_by_admin_id,reviewed_at,created_at,updated_at,company:partner_companies(id,name),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
    )
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("업그레이드 요청을 찾을 수 없습니다.");
  }

  const request = mapUpgradeRequest(data as UpgradeRequestRow);
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
    const { error: companyUpdateError } = await supabase
      .from("partner_companies")
      .update({
        plan_tier: request.requestedPlanTier,
        plan_started_at: reviewedAt,
        plan_updated_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq("id", request.companyId);
    if (companyUpdateError) {
      throw new Error(companyUpdateError.message);
    }

    const { error: eventError } = await supabase.from("partner_company_plan_events").insert({
      company_id: request.companyId,
      upgrade_request_id: request.id,
      previous_plan_tier: request.currentPlanTier,
      next_plan_tier: request.requestedPlanTier,
      source: "partner_upgrade",
      actor_admin_id: input.adminId,
      actor_partner_account_id: request.requestedByAccountId,
      plan_started_at: reviewedAt,
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
      ? `${request.companyName}의 ${getPartnerCompanyPlanDefinition(request.requestedPlanTier).label} 플랜이 적용되었습니다.`
      : `${request.companyName}의 플랜 업그레이드 요청이 반려되었습니다.${adminNote ? ` 사유: ${adminNote}` : ""}`,
    targetUrl: "/partner/plans",
    metadata: { requestId: request.id, companyId: request.companyId },
  }).catch((notificationError) => {
    console.error("[partner-plan-service] review notification failed", notificationError);
  });
}
