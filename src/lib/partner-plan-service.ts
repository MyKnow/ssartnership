import { randomUUID } from "node:crypto";
import {
  getPartnerCompanyPlanDefinition,
  normalizePartnerCompanyPlanTier,
  resolvePartnerBrandPlanWindow,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import {
  calculatePartnerPlanUpgradeCharge,
  getOverdueDowngradeCandidate,
  getPaymentDueAt,
  normalizePartnerBillingProfileInput,
  type PartnerBillingInvoiceStatus,
  type PartnerBillingProfileInput,
  type PartnerTaxDocumentStatus,
} from "@/lib/partner-billing";
import { listMockPartnerPortalCompanySetups } from "@/lib/mock/partner-portal/store";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import { isPartnerPortalMock } from "@/lib/partner-portal";
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
  companyId?: string | null;
  accountId: string;
  requestedPlanTier: string;
  payerName: string;
  memo: string;
  billingProfile: PartnerBillingProfileInput;
}) {
  const brand = await assertPartnerBrandAccess(input.accountId, input.partnerId);
  if (input.companyId && brand.companyId !== input.companyId) {
    throw new Error("브랜드 접근 권한이 없습니다.");
  }
  const requestedPlanTier = normalizeRequestedPlanTier(
    input.requestedPlanTier,
    brand.planTier,
  );
  const payerName = normalizePlanUpgradePayerName(input.payerName);
  const memo = normalizePlanUpgradeMemo(input.memo);
  const billingProfile = normalizePartnerBillingProfileInput(input.billingProfile);
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
  let insertedRequestId: string | null = null;

  const { error: profileError } = await supabase
    .from("partner_billing_profiles")
    .upsert(
      {
        company_id: brand.companyId,
        business_registration_number: billingProfile.businessRegistrationNumber,
        business_name: billingProfile.businessName,
        representative_name: billingProfile.representativeName,
        business_address: billingProfile.businessAddress,
        business_type: billingProfile.businessType,
        business_item: billingProfile.businessItem,
        tax_invoice_email: billingProfile.taxInvoiceEmail,
        tax_document_type: "tax_invoice",
      },
      { onConflict: "company_id" },
    );
  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data, error } = await supabase
    .from("partner_plan_upgrade_requests")
    .insert({
      partner_id: brand.id,
      company_id: brand.companyId,
      requested_by_account_id: input.accountId,
      current_plan_tier: brand.planTier,
      requested_plan_tier: requestedPlanTier,
      payment_amount_krw: charge.totalAmountKrw,
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
  insertedRequestId = request.id;
  let billingInvoice: PartnerBillingInvoiceRecord | null = null;
  try {
    const { data: invoiceData, error: invoiceError } = await supabase
      .from("partner_billing_invoices")
      .insert({
        invoice_number: createPartnerBillingInvoiceNumber(nowIso),
        company_id: brand.companyId,
        partner_id: brand.id,
        upgrade_request_id: request.id,
        requested_by_account_id: input.accountId,
        billing_reason: "plan_upgrade",
        billing_policy: charge.policy,
        payment_method: "manual_bank_transfer",
        status: "pending_payment",
        current_plan_tier: brand.planTier,
        requested_plan_tier: requestedPlanTier,
        remaining_days: charge.remainingDays,
        service_period_start: servicePeriod.servicePeriodStart,
        service_period_end: servicePeriod.servicePeriodEnd,
        supply_amount_krw: charge.supplyAmountKrw,
        vat_amount_krw: charge.vatAmountKrw,
        total_amount_krw: charge.totalAmountKrw,
        due_at: dueAt,
        metadata: {
          vatIncluded: true,
          taxDocumentType: "tax_invoice",
        },
      })
      .select(
        "id,invoice_number,upgrade_request_id,status,billing_policy,remaining_days,service_period_start,service_period_end,supply_amount_krw,vat_amount_krw,total_amount_krw,due_at,paid_at",
      )
      .single();
    if (invoiceError || !invoiceData) {
      throw new Error(invoiceError?.message ?? "청구서를 생성하지 못했습니다.");
    }

    const invoice = invoiceData as BillingInvoiceRow;
    const [paymentResult, taxDocumentResult, requestUpdateResult] = await Promise.all([
      supabase.from("partner_billing_payments").insert({
        invoice_id: invoice.id,
        method: "manual_bank_transfer",
        status: "awaiting_transfer",
        amount_krw: charge.totalAmountKrw,
        payer_name: payerName,
        memo,
      }),
      supabase.from("partner_tax_documents").insert({
        invoice_id: invoice.id,
        type: "tax_invoice",
        status: "requested",
        business_registration_number: billingProfile.businessRegistrationNumber,
        business_name: billingProfile.businessName,
        representative_name: billingProfile.representativeName,
        business_address: billingProfile.businessAddress,
        business_type: billingProfile.businessType,
        business_item: billingProfile.businessItem,
        tax_invoice_email: billingProfile.taxInvoiceEmail,
        provider: "manual_hometax",
      }),
      supabase
        .from("partner_plan_upgrade_requests")
        .update({ billing_invoice_id: invoice.id })
        .eq("id", request.id),
    ]);
    if (paymentResult.error) {
      throw new Error(paymentResult.error.message);
    }
    if (taxDocumentResult.error) {
      throw new Error(taxDocumentResult.error.message);
    }
    if (requestUpdateResult.error) {
      throw new Error(requestUpdateResult.error.message);
    }

    billingInvoice = mapBillingInvoice(
      invoice,
      {
        invoice_id: invoice.id,
        status: "awaiting_transfer",
        confirmed_at: null,
      },
      {
        invoice_id: invoice.id,
        status: "requested",
        issued_at: null,
      },
    );
  } catch (billingError) {
    if (insertedRequestId) {
      try {
        const { error: cleanupError } = await supabase
          .from("partner_plan_upgrade_requests")
          .delete()
          .eq("id", insertedRequestId);
        if (cleanupError) {
          console.error("[partner-plan-service] cleanup failed", cleanupError);
        }
      } catch (cleanupError) {
        console.error("[partner-plan-service] cleanup failed", cleanupError);
      }
    }
    throw billingError;
  }

  await Promise.all([
    createAdminOperationalNotification({
      type: "partner_change_request",
      title: `${brand.name} 플랜 업그레이드 요청`,
      body: `${getPartnerCompanyPlanDefinition(brand.planTier).label}에서 ${getPartnerCompanyPlanDefinition(requestedPlanTier).label}로 변경 요청이 접수되었습니다. 계좌이체 입금 확인이 필요합니다.`,
      targetUrl: "/admin/partners?tab=plans",
      metadata: { requestId: request.id, partnerId: brand.id, companyId: brand.companyId, requestedPlanTier, totalAmountKrw: charge.totalAmountKrw },
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
  const billingByRequestId =
    await getPartnerBillingInvoiceSummariesForUpgradeRequests([input.requestId]);
  const invoice = billingByRequestId.get(input.requestId);
  if (!invoice) {
    throw new Error("청구서를 찾을 수 없습니다.");
  }
  if (invoice.invoiceStatus === "cancelled") {
    throw new Error("취소된 청구서는 입금 확인할 수 없습니다.");
  }
  if (invoice.invoiceStatus === "paid") {
    return invoice;
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const [invoiceResult, paymentResult, taxDocumentResult] = await Promise.all([
    supabase
      .from("partner_billing_invoices")
      .update({
        status: "paid",
        paid_at: now,
      })
      .eq("id", invoice.id),
    supabase
      .from("partner_billing_payments")
      .update({
        status: "confirmed",
        confirmed_by_admin_id: input.adminId,
        confirmed_at: now,
      })
      .eq("invoice_id", invoice.id),
    supabase
      .from("partner_tax_documents")
      .update({
        status: input.taxDocumentStatus,
        issued_by_admin_id:
          input.taxDocumentStatus === "issued" ? input.adminId : null,
        issued_at: input.taxDocumentStatus === "issued" ? now : null,
        sent_at: input.taxDocumentStatus === "issued" ? now : null,
      })
      .eq("invoice_id", invoice.id),
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

  return {
    ...invoice,
    invoiceStatus: "paid" as const,
    paymentStatus: "confirmed" as const,
    taxDocumentStatus: input.taxDocumentStatus,
    paidAt: now,
    paymentConfirmedAt: now,
    taxDocumentIssuedAt: input.taxDocumentStatus === "issued" ? now : null,
  };
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
    targetUrl: getCompanyScopedPortalHref(brand.companyId, "plans"),
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
  }).catch((notificationError) => {
    console.error("[partner-plan-service] review notification failed", notificationError);
  });
}

export async function runPartnerBillingOverdueDowngrades(now = new Date()) {
  const nowIso = now.toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_billing_invoices")
    .select(
      "id,invoice_number,company_id,partner_id,upgrade_request_id,status,requested_plan_tier,due_at",
    )
    .eq("status", "pending_payment")
    .lte("due_at", nowIso)
    .limit(100);
  if (error) {
    throw new Error(error.message);
  }

  const candidates = ((data ?? []) as BillingInvoiceRow[])
    .map((invoice) => {
      if (!invoice.company_id || !invoice.partner_id || !invoice.requested_plan_tier) {
        return null;
      }
      return {
        invoice,
        candidate: getOverdueDowngradeCandidate({
          invoiceId: invoice.id,
          partnerId: invoice.partner_id,
          requestedPlanTier: normalizePartnerCompanyPlanTier(invoice.requested_plan_tier),
          dueAt: invoice.due_at,
          status: invoice.status,
          now: nowIso,
        }),
      };
    })
    .filter(
      (item): item is { invoice: BillingInvoiceRow; candidate: NonNullable<ReturnType<typeof getOverdueDowngradeCandidate>> } =>
        Boolean(item?.candidate),
    );

  const results = [];
  for (const { invoice, candidate } of candidates) {
    const [brandResult, invoiceResult, requestResult, eventResult] =
      await Promise.all([
        supabase
          .from("partners")
          .update({
            plan_tier: candidate.downgradeTo,
            plan_started_at: null,
            plan_expires_at: null,
            plan_updated_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", candidate.partnerId),
        supabase
          .from("partner_billing_invoices")
          .update({
            status: "overdue",
            overdue_marked_at: nowIso,
            downgraded_at: nowIso,
          })
          .eq("id", candidate.invoiceId),
        invoice.upgrade_request_id
          ? supabase
              .from("partner_plan_upgrade_requests")
              .update({
                status: "cancelled",
                admin_note: "미납 7일 경과로 자동 취소되었습니다.",
                updated_at: nowIso,
              })
              .eq("id", invoice.upgrade_request_id)
          : Promise.resolve({ error: null }),
        supabase.from("partner_brand_plan_events").insert({
          partner_id: candidate.partnerId,
          company_id: invoice.company_id,
          upgrade_request_id: invoice.upgrade_request_id,
          previous_plan_tier: invoice.requested_plan_tier,
          next_plan_tier: candidate.downgradeTo,
          source: "system",
          plan_started_at: null,
          plan_expires_at: null,
          note: "계좌이체 청구 미납 7일 경과로 Basic 플랜으로 자동 조정",
          metadata: {
            invoiceId: candidate.invoiceId,
            invoiceNumber: invoice.invoice_number,
            reason: candidate.reason,
          },
        }),
      ]);

    const firstError =
      brandResult.error ??
      invoiceResult.error ??
      requestResult.error ??
      eventResult.error;
    if (firstError) {
      throw new Error(firstError.message);
    }

    results.push({
      invoiceId: candidate.invoiceId,
      partnerId: candidate.partnerId,
      downgradedTo: candidate.downgradeTo,
    });
  }

  return {
    checked: (data ?? []).length,
    downgraded: results.length,
    results,
  };
}
