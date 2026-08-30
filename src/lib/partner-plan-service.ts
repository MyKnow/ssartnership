import { randomUUID } from "node:crypto";
import {
  getPartnerCompanyPlanDefinition,
  normalizePartnerCompanyPlanTier,
  resolvePartnerBrandPlanWindow,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import {
  calculatePartnerPlanUpgradeCharge,
  getPaymentDueAt,
  type PartnerBillingInvoiceStatus,
  type PartnerTaxDocumentStatus,
} from "@/lib/partner-billing";
import { resolvePartnerBillingProfileForPlanRequest } from "@/lib/partner-billing-profiles";
import { listMockPartnerPortalCompanySetups } from "@/lib/mock/partner-portal/store";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { normalizePartnerVisibility } from "@/lib/partner-visibility";
import type { PartnerVisibility } from "@/lib/types";
import {
  assertPartnerPlanUpgradeTransition,
  normalizePartnerPlanUpgradeRequestStatus,
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
  visibility: PartnerVisibility;
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
  billingInvoice: PartnerBillingInvoiceRecord | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerBillingInvoiceRecord = {
  id: string;
  invoiceNumber: string;
  invoiceStatus: PartnerBillingInvoiceStatus;
  paymentStatus: "awaiting_transfer" | "confirmed" | "cancelled" | "failed" | null;
  taxDocumentStatus: PartnerTaxDocumentStatus | null;
  billingPolicy: "first_month_full_amount" | "remaining_period_difference";
  remainingDays: number;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
  dueAt: string;
  paidAt: string | null;
  paymentConfirmedAt: string | null;
  taxDocumentIssuedAt: string | null;
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
  billing_invoice_id?: string | null;
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

type BillingInvoiceRow = {
  id: string;
  invoice_number: string;
  company_id?: string | null;
  partner_id?: string | null;
  upgrade_request_id?: string | null;
  status: PartnerBillingInvoiceStatus;
  requested_plan_tier?: PartnerCompanyPlanTier;
  billing_policy: "first_month_full_amount" | "remaining_period_difference";
  remaining_days: number;
  service_period_start?: string | null;
  service_period_end?: string | null;
  supply_amount_krw: number;
  vat_amount_krw: number;
  total_amount_krw: number;
  due_at: string;
  paid_at?: string | null;
};

type BillingPaymentRow = {
  invoice_id: string;
  status: "awaiting_transfer" | "confirmed" | "cancelled" | "failed";
  confirmed_at?: string | null;
};

type TaxDocumentRow = {
  invoice_id: string;
  status: PartnerTaxDocumentStatus;
  issued_at?: string | null;
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

type SupabaseMutationError = {
  code?: string | null;
  message?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getAtomicRpcRow<T>(
  payload: unknown,
  key: string,
  fallbackMessage: string,
) {
  if (!isRecord(payload) || !isRecord(payload[key])) {
    throw new Error(fallbackMessage);
  }
  return payload[key] as T;
}

function getCreateUpgradeBillingErrorMessage(error: SupabaseMutationError) {
  const message = error.message ?? "";
  if (
    error.code === "23505" &&
    message.includes("partner_plan_upgrade_requests_pending_partner_idx")
  ) {
    return "이미 처리 대기 중인 업그레이드 요청이 있습니다.";
  }
  if (message.includes("partner_plan_billing_access_denied")) {
    return "파트너사 접근 권한이 없습니다.";
  }
  if (message.includes("partner_plan_billing_partner_not_found")) {
    return "제휴처를 찾을 수 없습니다.";
  }
  if (message.includes("partner_plan_billing_profile_not_found")) {
    return "프로필 탭에서 입금자와 세금계산서 정보를 먼저 저장해 주세요.";
  }
  if (
    message.includes("partner_plan_billing_state_changed") ||
    message.includes("partner_plan_billing_profile_changed")
  ) {
    return "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.";
  }
  if (message.includes("partner_plan_billing_invalid_request")) {
    return "플랜 청구 정보를 확인해 주세요.";
  }
  return "플랜 업그레이드 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function getConfirmBankTransferErrorMessage(error: SupabaseMutationError) {
  const message = error.message ?? "";
  if (message.includes("partner_plan_payment_request_state_conflict")) {
    return "처리 대기 중인 업그레이드 요청만 입금 확인할 수 있습니다.";
  }
  if (message.includes("partner_plan_payment_invoice_not_found")) {
    return "청구서를 찾을 수 없습니다.";
  }
  if (message.includes("partner_plan_payment_invoice_cancelled")) {
    return "취소된 청구서는 입금 확인할 수 없습니다.";
  }
  return "입금 확인 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCompanyIds(companyIds: string[]) {
  return [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
}

function addDaysIso(value: string, days: number) {
  return new Date(new Date(value).getTime() + days * 86_400_000).toISOString();
}

function createPartnerBillingInvoiceNumber(nowIso: string) {
  const date = nowIso.slice(0, 10).replaceAll("-", "");
  return `SSP-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function resolveBillingServicePeriod(input: {
  nowIso: string;
  remainingDays: number;
  fallbackPeriodEnd?: string | null;
}) {
  const fallbackTime = input.fallbackPeriodEnd
    ? new Date(input.fallbackPeriodEnd).getTime()
    : Number.NaN;
  const nowTime = new Date(input.nowIso).getTime();
  return {
    servicePeriodStart: input.nowIso,
    servicePeriodEnd:
      input.fallbackPeriodEnd && fallbackTime > nowTime
        ? input.fallbackPeriodEnd
        : addDaysIso(input.nowIso, input.remainingDays),
  };
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
    visibility: normalizePartnerVisibility(row.visibility),
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
    brandName: brand?.name ?? "미지정 제휴처",
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
    billingInvoice: null,
    reviewedByAdminId: row.reviewed_by_admin_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBillingInvoice(
  row: BillingInvoiceRow,
  payment?: BillingPaymentRow,
  taxDocument?: TaxDocumentRow,
): PartnerBillingInvoiceRecord {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceStatus: row.status,
    paymentStatus: payment?.status ?? null,
    taxDocumentStatus: taxDocument?.status ?? null,
    billingPolicy: row.billing_policy,
    remainingDays: Math.max(1, Number(row.remaining_days ?? 1)),
    servicePeriodStart: row.service_period_start ?? null,
    servicePeriodEnd: row.service_period_end ?? null,
    supplyAmountKrw: Math.max(0, Number(row.supply_amount_krw ?? 0)),
    vatAmountKrw: Math.max(0, Number(row.vat_amount_krw ?? 0)),
    totalAmountKrw: Math.max(0, Number(row.total_amount_krw ?? 0)),
    dueAt: row.due_at,
    paidAt: row.paid_at ?? null,
    paymentConfirmedAt: payment?.confirmed_at ?? null,
    taxDocumentIssuedAt: taxDocument?.issued_at ?? null,
  };
}

export async function getPartnerBillingInvoiceSummariesForUpgradeRequests(
  requestIds: string[],
) {
  const normalizedRequestIds = normalizeCompanyIds(requestIds);
  if (normalizedRequestIds.length === 0 || isPartnerPortalMock) {
    return new Map<string, PartnerBillingInvoiceRecord>();
  }

  const supabase = getSupabaseAdminClient();
  const { data: invoiceRows, error: invoiceError } = await supabase
    .from("partner_billing_invoices")
    .select(
      "id,invoice_number,upgrade_request_id,status,billing_policy,remaining_days,service_period_start,service_period_end,supply_amount_krw,vat_amount_krw,total_amount_krw,due_at,paid_at",
    )
    .in("upgrade_request_id", normalizedRequestIds);
  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  const invoices = (invoiceRows ?? []) as BillingInvoiceRow[];
  const invoiceIds = invoices.map((invoice) => invoice.id);
  if (invoiceIds.length === 0) {
    return new Map<string, PartnerBillingInvoiceRecord>();
  }

  const [paymentsResult, taxDocumentsResult] = await Promise.all([
    supabase
      .from("partner_billing_payments")
      .select("invoice_id,status,confirmed_at")
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_tax_documents")
      .select("invoice_id,status,issued_at")
      .in("invoice_id", invoiceIds),
  ]);
  if (paymentsResult.error) {
    throw new Error(paymentsResult.error.message);
  }
  if (taxDocumentsResult.error) {
    throw new Error(taxDocumentsResult.error.message);
  }

  const paymentByInvoiceId = new Map(
    ((paymentsResult.data ?? []) as BillingPaymentRow[]).map((payment) => [
      payment.invoice_id,
      payment,
    ]),
  );
  const taxDocumentByInvoiceId = new Map(
    ((taxDocumentsResult.data ?? []) as TaxDocumentRow[]).map((taxDocument) => [
      taxDocument.invoice_id,
      taxDocument,
    ]),
  );

  return new Map(
    invoices
      .filter((invoice) => invoice.upgrade_request_id)
      .map((invoice) => [
        invoice.upgrade_request_id as string,
        mapBillingInvoice(
          invoice,
          paymentByInvoiceId.get(invoice.id),
          taxDocumentByInvoiceId.get(invoice.id),
        ),
      ]),
  );
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

function loadMockPartnerPlanPortalData(
  companyIds: string[],
): PartnerPlanPortalData {
  const setups = listMockPartnerPortalCompanySetups(companyIds);
  const brands = setups.flatMap((setup) =>
    setup.company.services.map((service) => {
      const planTier = normalizePartnerCompanyPlanTier(service.planTier);
      const planWindow = resolvePartnerBrandPlanWindow({
        planTier,
        periodStart: null,
        periodEnd: null,
        planStartedAt: null,
        planExpiresAt: null,
      });

      return {
        id: service.id,
        name: service.name,
        companyId: setup.company.id,
        companyName: setup.company.name,
        companySlug: setup.company.slug,
        location: service.location,
        visibility: service.visibility,
        periodStart: null,
        periodEnd: null,
        planTier,
        planStartedAt: planWindow.planStartedAt,
        planExpiresAt: planWindow.planExpiresAt,
        planUpdatedAt: null,
      } satisfies PartnerBrandPlanRecord;
    }),
  );

  return {
    brands,
    requests: [],
    events: [],
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

  if (isPartnerPortalMock) {
    return loadMockPartnerPlanPortalData(normalizedCompanyIds);
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

  const mappedRequests = ((requestsResult.data ?? []) as UpgradeRequestRow[])
    .map(mapUpgradeRequest)
    .filter((request) => !accountId || request.requestedByAccountId === accountId || normalizedCompanyIds.includes(request.companyId));
  const billingByRequestId =
    await getPartnerBillingInvoiceSummariesForUpgradeRequests(
      mappedRequests.map((request) => request.id),
    );
  const requests = mappedRequests.map((request) => ({
    ...request,
    billingInvoice: billingByRequestId.get(request.id) ?? null,
  }));

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
    throw new Error("제휴처를 찾을 수 없습니다.");
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
  companyId?: string | null;
  accountId: string;
  requestedPlanTier: string;
  memo: string;
  billingProfileId: string;
}) {
  const brand = await assertPartnerBrandAccess(input.accountId, input.partnerId);
  if (input.companyId && brand.companyId !== input.companyId) {
    throw new Error("제휴처 접근 권한이 없습니다.");
  }
  const requestedPlanTier = normalizeRequestedPlanTier(
    input.requestedPlanTier,
    brand.planTier,
  );
  const memo = normalizePlanUpgradeMemo(input.memo);
  const resolvedBillingProfile = await resolvePartnerBillingProfileForPlanRequest({
    accountId: input.accountId,
    companyId: brand.companyId,
    billingProfileId: input.billingProfileId,
  });
  const payerName = normalizePlanUpgradePayerName(
    resolvedBillingProfile.payerName,
  );
  const nowIso = new Date().toISOString();
  const charge = calculatePartnerPlanUpgradeCharge({
    currentPlanTier: brand.planTier,
    requestedPlanTier,
    effectiveAt: nowIso,
    currentPeriodStart: brand.planStartedAt,
    currentPeriodEnd: brand.planExpiresAt,
  });
  const servicePeriod = resolveBillingServicePeriod({
    nowIso,
    remainingDays: charge.remainingDays,
    fallbackPeriodEnd:
      charge.policy === "remaining_period_difference" ? brand.planExpiresAt : null,
  });
  const dueAt = getPaymentDueAt(nowIso);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "create_partner_plan_upgrade_billing",
    {
      p_partner_id: brand.id,
      p_company_id: brand.companyId,
      p_account_id: input.accountId,
      p_billing_profile_id: resolvedBillingProfile.profileId,
      p_expected_current_plan_tier: brand.planTier,
      p_expected_plan_updated_at: brand.planUpdatedAt,
      p_requested_plan_tier: requestedPlanTier,
      p_invoice_number: createPartnerBillingInvoiceNumber(nowIso),
      p_billing_policy: charge.policy,
      p_remaining_days: charge.remainingDays,
      p_service_period_start: servicePeriod.servicePeriodStart,
      p_service_period_end: servicePeriod.servicePeriodEnd,
      p_supply_amount_krw: charge.supplyAmountKrw,
      p_vat_amount_krw: charge.vatAmountKrw,
      p_total_amount_krw: charge.totalAmountKrw,
      p_due_at: dueAt,
      p_payer_name: payerName,
      p_memo: memo,
    },
  );
  if (error) {
    throw new Error(getCreateUpgradeBillingErrorMessage(error));
  }

  const requestRow = getAtomicRpcRow<UpgradeRequestRow>(
    data,
    "request",
    "생성된 업그레이드 요청을 확인하지 못했습니다.",
  );
  const invoiceRow = getAtomicRpcRow<BillingInvoiceRow>(
    data,
    "invoice",
    "생성된 청구서를 확인하지 못했습니다.",
  );
  const paymentRow = getAtomicRpcRow<BillingPaymentRow>(
    data,
    "payment",
    "생성된 결제 정보를 확인하지 못했습니다.",
  );
  const taxDocumentRow = getAtomicRpcRow<TaxDocumentRow>(
    data,
    "taxDocument",
    "생성된 세금계산서 정보를 확인하지 못했습니다.",
  );
  const requestedByDisplayName =
    isRecord(data) && typeof data.requestedByDisplayName === "string"
      ? data.requestedByDisplayName
      : null;
  const request = mapUpgradeRequest({
    ...requestRow,
    brand: { id: brand.id, name: brand.name },
    company: { id: brand.companyId, name: brand.companyName },
    requested_by: {
      id: input.accountId,
      display_name: requestedByDisplayName,
    },
  });
  const billingInvoice = mapBillingInvoice(
    invoiceRow,
    paymentRow,
    taxDocumentRow,
  );

  await Promise.all([
    createAdminOperationalNotification({
      type: "partner_change_request",
      title: `${brand.name} 플랜 업그레이드 요청`,
      body: `${getPartnerCompanyPlanDefinition(brand.planTier).label}에서 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label}로 변경 요청이 접수되었습니다. 계좌이체 입금 확인이 필요합니다.`,
      targetUrl: "/admin/partners?tab=plans",
      metadata: { requestId: request.id, partnerId: brand.id, companyId: brand.companyId, requestedPlanTier, totalAmountKrw: charge.totalAmountKrw },
      templateVariant: "partner_plan_upgrade_request",
      templateContext: {
        kind: "admin_partner_plan_upgrade_request",
        companyName: brand.companyName,
        partnerName: brand.name,
        requesterName: request.requestedByDisplayName ?? "파트너 담당자",
        currentPlanName: getPartnerCompanyPlanDefinition(brand.planTier).label,
        requestedPlanName: getPartnerCompanyPlanDefinition(requestedPlanTier).label,
        amountKrw: `${charge.totalAmountKrw.toLocaleString("ko-KR")}원`,
        requestUrl: "/admin/partners?tab=plans",
      },
    }).catch((error) => {
      console.error("[partner-plan-service] admin upgrade notification failed", error);
    }),
    createPartnerOperationalNotification({
      type: "plan_upgrade_requested",
      companyId: brand.companyId,
      accountIds: [input.accountId],
      title: "플랜 업그레이드 요청이 접수되었습니다",
      body: `${brand.name}의 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label} 업그레이드 청구서가 생성되었습니다. 계좌이체 후 관리자 확인을 기다려 주세요.`,
      targetUrl: getCompanyScopedPortalHref(brand.companyId, "plans"),
      metadata: { requestId: request.id, partnerId: brand.id, companyId: brand.companyId, requestedPlanTier, totalAmountKrw: charge.totalAmountKrw },
      templateContext: {
        kind: "partner_plan_upgrade_requested",
        partnerName: brand.name,
        requestedPlanName: getPartnerCompanyPlanDefinition(requestedPlanTier).label,
        amountKrw: `${charge.totalAmountKrw.toLocaleString("ko-KR")}원`,
        paymentDueAt: billingInvoice?.dueAt ?? "",
        planUrl: getCompanyScopedPortalHref(brand.companyId, "plans"),
      },
    }).catch((error) => {
      console.error("[partner-plan-service] partner upgrade notification failed", error);
    }),
  ]);

  return { ...request, billingInvoice };
}

async function cancelBillingForUpgradeRequest(
  requestId: string,
  cancelledAt = new Date().toISOString(),
) {
  const supabase = getSupabaseAdminClient();
  const billingByRequestId =
    await getPartnerBillingInvoiceSummariesForUpgradeRequests([requestId]);
  const invoice = billingByRequestId.get(requestId);
  if (!invoice) {
    return;
  }

  const [invoiceResult, paymentResult, taxDocumentResult] = await Promise.all([
    supabase
      .from("partner_billing_invoices")
      .update({
        status: "cancelled",
        cancelled_at: cancelledAt,
      })
      .eq("id", invoice.id)
      .neq("status", "paid"),
    supabase
      .from("partner_billing_payments")
      .update({ status: "cancelled" })
      .eq("invoice_id", invoice.id)
      .neq("status", "confirmed"),
    supabase
      .from("partner_tax_documents")
      .update({ status: "cancelled", cancelled_at: cancelledAt })
      .eq("invoice_id", invoice.id)
      .in("status", ["requested", "pending_issue"]),
  ]);
  if (invoiceResult.error) {
    throw new Error(invoiceResult.error.message);
  }
  if (paymentResult.error) {
    throw new Error(paymentResult.error.message);
  }
  if (taxDocumentResult.error) {
    throw new Error(taxDocumentResult.error.message);
  }
}

export async function confirmPartnerPlanBankTransferPayment(input: {
  requestId: string;
  adminId: string;
  taxDocumentStatus: Extract<PartnerTaxDocumentStatus, "pending_issue" | "issued">;
}) {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "confirm_partner_plan_bank_transfer_payment",
    {
      p_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_tax_document_status: input.taxDocumentStatus,
      p_confirmed_at: now,
    },
  );
  if (error) {
    throw new Error(getConfirmBankTransferErrorMessage(error));
  }

  return mapBillingInvoice(
    getAtomicRpcRow<BillingInvoiceRow>(
      data,
      "invoice",
      "확정된 청구서를 확인하지 못했습니다.",
    ),
    getAtomicRpcRow<BillingPaymentRow>(
      data,
      "payment",
      "확정된 결제 정보를 확인하지 못했습니다.",
    ),
    getAtomicRpcRow<TaxDocumentRow>(
      data,
      "taxDocument",
      "확정된 세금계산서 정보를 확인하지 못했습니다.",
    ),
  );
}

export async function cancelPartnerPlanUpgradeRequest(input: {
  requestId: string;
  accountId: string;
  companyId?: string | null;
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
  if (input.companyId && data.company_id !== input.companyId) {
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
  await cancelBillingForUpgradeRequest(input.requestId);
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
    throw new Error("파트너사가 연결된 제휴처만 플랜을 변경할 수 있습니다.");
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
    targetUrl: getCompanyScopedPortalHref(brand.companyId, "plans"),
    metadata: { partnerId: input.partnerId, companyId: brand.companyId, nextPlanTier: input.nextPlanTier },
    templateContext: {
      kind: "partner_plan_changed",
      partnerName: brand.name,
      previousPlanName: getPartnerCompanyPlanDefinition(brand.planTier).label,
      nextPlanName: getPartnerCompanyPlanDefinition(input.nextPlanTier).label,
      effectiveAt: planWindow.planStartedAt ?? "",
      expiresAt: planWindow.planExpiresAt ?? "",
      planUrl: getCompanyScopedPortalHref(brand.companyId, "plans"),
      note: input.note || "",
    },
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
    throw new Error("제휴처를 찾을 수 없습니다.");
  }
  assertPartnerPlanUpgradeTransition(request.status, input.nextStatus);
  const reviewedAt = new Date().toISOString();
  const adminNote = normalizePlanUpgradeMemo(input.adminNote);
  const billingByRequestId =
    await getPartnerBillingInvoiceSummariesForUpgradeRequests([request.id]);
  const billingInvoice = billingByRequestId.get(request.id) ?? null;

  if (input.nextStatus === "approved" && billingInvoice?.invoiceStatus !== "paid") {
    throw new Error("입금 확인 후 플랜을 승인할 수 있습니다.");
  }

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
    const planStartedAt = billingInvoice?.paidAt ?? reviewedAt;
    const planExpiresAt =
      billingInvoice?.servicePeriodEnd ??
      addDaysIso(planStartedAt, billingInvoice?.remainingDays ?? 30);
    const { error: brandUpdateError } = await supabase
      .from("partners")
      .update({
        plan_tier: request.requestedPlanTier,
        plan_started_at: planStartedAt,
        plan_expires_at: planExpiresAt,
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
      plan_started_at: planStartedAt,
      plan_expires_at: planExpiresAt,
      note: adminNote,
    });
    if (eventError) {
      throw new Error(eventError.message);
    }
  } else {
    await cancelBillingForUpgradeRequest(request.id, reviewedAt);
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
    targetUrl: getCompanyScopedPortalHref(request.companyId, "plans"),
    metadata: { requestId: request.id, partnerId: request.partnerId, companyId: request.companyId },
    templateContext: approved
      ? {
          kind: "partner_plan_upgrade_approved",
          partnerName: request.brandName,
          requestedPlanName: getPartnerCompanyPlanDefinition(request.requestedPlanTier).label,
          effectiveAt: billingInvoice?.paidAt ?? reviewedAt,
          expiresAt: billingInvoice?.servicePeriodEnd ?? "",
          planUrl: getCompanyScopedPortalHref(request.companyId, "plans"),
        }
      : {
          kind: "partner_plan_upgrade_rejected",
          partnerName: request.brandName,
          requestedPlanName: getPartnerCompanyPlanDefinition(request.requestedPlanTier).label,
          rejectionReason: adminNote || "관리자 검토 결과 반려되었습니다.",
          planUrl: getCompanyScopedPortalHref(request.companyId, "plans"),
        },
  }).catch((notificationError) => {
    console.error("[partner-plan-service] review notification failed", notificationError);
  });
}

export async function runPartnerBillingOverdueDowngrades(now = new Date()) {
  const nowIso = now.toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "process_partner_billing_overdue_downgrades",
    {
      p_now: nowIso,
      p_limit: 100,
    },
  );
  if (error) {
    console.error(
      "[partner-plan-service] overdue downgrade transaction failed",
      error,
    );
    throw new Error("미납 플랜 자동 조정을 완료하지 못했습니다.");
  }
  if (!isRecord(data) || !Array.isArray(data.results)) {
    throw new Error("미납 플랜 자동 조정 결과를 확인하지 못했습니다.");
  }

  const checked = Number(data.checked);
  const downgraded = Number(data.downgraded);
  const results = data.results.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.invoiceId !== "string" ||
      typeof item.partnerId !== "string" ||
      item.downgradedTo !== "basic"
    ) {
      throw new Error("미납 플랜 자동 조정 결과를 확인하지 못했습니다.");
    }
    return {
      invoiceId: item.invoiceId,
      partnerId: item.partnerId,
      downgradedTo: "basic" as const,
    };
  });
  if (
    !Number.isInteger(checked) ||
    checked < 0 ||
    !Number.isInteger(downgraded) ||
    downgraded < 0 ||
    downgraded !== results.length
  ) {
    throw new Error("미납 플랜 자동 조정 결과를 확인하지 못했습니다.");
  }

  return { checked, downgraded, results };
}
