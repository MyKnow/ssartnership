import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  resolveProfile: vi.fn(),
  adminNotification: vi.fn(),
  partnerNotification: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: mocks.client }));
vi.mock("@/lib/partner-billing-profiles", () => ({
  resolvePartnerBillingProfileForPlanRequest: mocks.resolveProfile,
}));
vi.mock("@/lib/operational-notifications", () => ({
  createAdminOperationalNotification: mocks.adminNotification,
  createPartnerOperationalNotification: mocks.partnerNotification,
}));
vi.mock("@/lib/server-log", () => ({ logServerError: mocks.logError }));
vi.mock("@/lib/partner-auth/portal", () => ({ isPartnerPortalMock: false }));
vi.mock("@/lib/mock/partner-portal/store", () => ({ listMockPartnerPortalCompanySetups: vi.fn() }));

import {
  cancelPartnerPlanUpgradeRequest,
  confirmPartnerPlanBankTransferPayment,
  createPartnerPlanUpgradeRequest,
  reviewPartnerPlanUpgradeRequest,
  runPartnerBillingOverdueDowngrades,
  updatePartnerBrandPlanByAdmin,
} from "../../src/lib/partner-plan-service";

const NOW = "2026-10-17T03:00:00.000Z";
const DUE = "2026-10-24T03:00:00.000Z";
const PERIOD_END = "2026-11-16T03:00:00.000Z";
const brand = {
  id: "partner-a", company_id: "company-a", name: "서울 카페", plan_tier: "basic",
  plan_updated_at: "2026-10-01T00:00:00.000Z",
  company: { id: "company-a", name: "카페 회사", slug: "cafe" },
};
const request = {
  id: "request-a", partner_id: "partner-a", company_id: "company-a",
  requested_by_account_id: "account-a", current_plan_tier: "basic", requested_plan_tier: "partner",
  status: "pending", payment_amount_krw: 50_000, payer_name: "입금자", memo: "신청 메모", admin_note: "",
  created_at: NOW, updated_at: NOW, brand: { id: "partner-a", name: "서울 카페" },
};
const invoice = {
  id: "invoice-a", invoice_number: "SSP-20261017-12345678", status: "pending_payment",
  billing_policy: "first_month_full_amount", remaining_days: 30,
  service_period_start: NOW, service_period_end: PERIOD_END,
  supply_amount_krw: 45_455, vat_amount_krw: 4_545, total_amount_krw: 50_000, due_at: DUE,
};
const payload = {
  request, invoice,
  payment: { status: "awaiting_transfer" }, taxDocument: { status: "requested" },
  requestedByDisplayName: "담당자",
};
const createInput = {
  partnerId: "partner-a", companyId: "company-a", accountId: "account-a",
  requestedPlanTier: "partner", memo: "  신청 메모  ", billingProfileId: "profile-a",
};
const confirmInput = { requestId: "request-a", adminId: "admin-a", taxDocumentStatus: "issued" as const };
const cancelInput = { requestId: "request-a", accountId: "account-a", companyId: "company-a" };
const updateInput = {
  partnerId: "partner-a", expectedPlanTier: "basic" as const,
  expectedPlanUpdatedAt: brand.plan_updated_at, nextPlanTier: "partner" as const,
  planStartedAt: NOW, planExpiresAt: PERIOD_END, adminId: "admin-a", note: "관리자 변경",
};
const reviewInput = { requestId: "request-a", adminId: "admin-a", nextStatus: "approved" as const, adminNote: "  확인  " };

// Only the three reads these mutations need are supported. Direct table writes
// intentionally have no stub, so replacing an atomic RPC with writes fails here.
const brandRead = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
const accessRead = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
const requestRead = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
const invoiceRead = { select: vi.fn(), in: vi.fn() };
const rpc = vi.fn();
const from = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  for (const read of [brandRead, accessRead, requestRead]) {
    read.select.mockReturnValue(read);
    read.eq.mockReturnValue(read);
  }
  brandRead.maybeSingle.mockResolvedValue({ data: brand, error: null });
  accessRead.maybeSingle.mockResolvedValue({ data: { id: "membership-a" }, error: null });
  requestRead.maybeSingle.mockResolvedValue({ data: request, error: null });
  invoiceRead.select.mockReturnValue(invoiceRead);
  invoiceRead.in.mockResolvedValue({ data: [], error: null });
  from.mockImplementation((table: string) => {
    switch (table) {
      case "partners": return brandRead;
      case "partner_account_companies": return accessRead;
      case "partner_plan_upgrade_requests": return requestRead;
      case "partner_billing_invoices": return invoiceRead;
      default: throw new Error(`Unexpected billing table: ${table}`);
    }
  });
  mocks.client.mockReturnValue({ from, rpc });
  mocks.resolveProfile.mockResolvedValue({ profileId: "profile-a", payerName: "  입금자  " });
  mocks.adminNotification.mockResolvedValue(undefined);
  mocks.partnerNotification.mockResolvedValue(undefined);
  rpc.mockResolvedValue({ data: payload, error: null });
});
afterEach(() => vi.useRealTimers());

function expectNoNotifications() {
  expect(mocks.adminNotification).not.toHaveBeenCalled();
  expect(mocks.partnerNotification).not.toHaveBeenCalled();
}

describe("partner upgrade billing creation", () => {
  test("validates active company membership and sends one complete atomic billing request", async () => {
    const result = await createPartnerPlanUpgradeRequest(createInput);

    expect(accessRead.eq.mock.calls).toEqual([
      ["account_id", "account-a"], ["company_id", "company-a"], ["is_active", true],
    ]);
    expect(mocks.resolveProfile).toHaveBeenCalledWith({ accountId: "account-a", companyId: "company-a", billingProfileId: "profile-a" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_partner_plan_upgrade_billing", {
      p_partner_id: "partner-a", p_company_id: "company-a", p_account_id: "account-a", p_billing_profile_id: "profile-a",
      p_expected_current_plan_tier: "basic", p_expected_plan_updated_at: brand.plan_updated_at,
      p_requested_plan_tier: "partner", p_invoice_number: expect.stringMatching(/^SSP-20261017-[0-9A-F]{8}$/),
      p_billing_policy: "first_month_full_amount", p_remaining_days: 30,
      p_service_period_start: NOW, p_service_period_end: PERIOD_END,
      p_supply_amount_krw: 45_455, p_vat_amount_krw: 4_545, p_total_amount_krw: 50_000,
      p_due_at: DUE, p_payer_name: "입금자", p_memo: "신청 메모",
    });
    expect(result).toMatchObject({
      id: "request-a", brandName: "서울 카페", companyName: "카페 회사", requestedByDisplayName: "담당자",
      billingInvoice: { id: "invoice-a", totalAmountKrw: 50_000, invoiceStatus: "pending_payment", paymentStatus: "awaiting_transfer", taxDocumentStatus: "requested" },
    });
    expect(mocks.adminNotification).toHaveBeenCalledWith(expect.objectContaining({
      targetUrl: "/admin/partners?tab=plans", metadata: expect.objectContaining({ requestId: "request-a", totalAmountKrw: 50_000 }),
    }));
    expect(mocks.partnerNotification).toHaveBeenCalledWith(expect.objectContaining({
      companyId: "company-a", accountIds: ["account-a"], targetUrl: "/partner/companies/company-a/plans",
      templateContext: expect.objectContaining({ paymentDueAt: DUE }),
    }));
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.adminNotification.mock.invocationCallOrder[0]);
  });

  test("charges only the remaining paid period difference and preserves its end date", async () => {
    const end = "2026-10-31T03:00:00.000Z";
    brandRead.maybeSingle.mockResolvedValue({ data: { ...brand, plan_tier: "partner", plan_started_at: "2026-10-01T03:00:00.000Z", plan_expires_at: end }, error: null });
    await createPartnerPlanUpgradeRequest({ ...createInput, requestedPlanTier: "boost" });
    expect(rpc).toHaveBeenCalledWith("create_partner_plan_upgrade_billing", expect.objectContaining({
      p_expected_current_plan_tier: "partner", p_requested_plan_tier: "boost",
      p_billing_policy: "remaining_period_difference", p_remaining_days: 14,
      p_service_period_end: end, p_total_amount_krw: 46_667,
    }));
  });

  test.each([
    ["missing brand", null, { id: "membership-a" }, "제휴처를 찾을 수 없습니다."],
    ["missing company", { ...brand, company_id: null, company: null }, { id: "membership-a" }, "파트너사 접근 권한이 없습니다."],
    ["inactive or absent membership", brand, null, "파트너사 접근 권한이 없습니다."],
  ])("rejects %s before billing or notification side effects", async (_label, brandRow, membership, message) => {
    brandRead.maybeSingle.mockResolvedValue({ data: brandRow, error: null });
    accessRead.maybeSingle.mockResolvedValue({ data: membership, error: null });
    await expect(createPartnerPlanUpgradeRequest(createInput)).rejects.toThrow(message);
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.resolveProfile).not.toHaveBeenCalled();
    expectNoNotifications();
  });

  test.each([
    [{ companyId: "another-company" }, "제휴처 접근 권한이 없습니다."],
    [{ requestedPlanTier: "basic" }, "변경할 플랜을 확인해 주세요."],
    [{ memo: "가".repeat(1_001) }, "요청 메모는 1,000자 이하로 입력해 주세요."],
  ])("rejects invalid request input %j before creating billing", async (input, message) => {
    await expect(createPartnerPlanUpgradeRequest({ ...createInput, ...input })).rejects.toThrow(message);
    expect(rpc).not.toHaveBeenCalled();
    expectNoNotifications();
  });

  test("stops if the billing profile cannot be resolved", async () => {
    mocks.resolveProfile.mockRejectedValue(new Error("프로필 정보를 확인해 주세요."));
    await expect(createPartnerPlanUpgradeRequest(createInput)).rejects.toThrow("프로필 정보를 확인해 주세요.");
    expect(rpc).not.toHaveBeenCalled();
    expectNoNotifications();
  });

  test.each([
    [{ code: "23505", message: "partner_plan_upgrade_requests_pending_partner_idx" }, "이미 처리 대기 중인 업그레이드 요청이 있습니다."],
    [{ message: "partner_plan_billing_state_changed" }, "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요."],
    [{ message: "partner_plan_billing_profile_changed" }, "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요."],
    [{ message: "private provider failure" }, "플랜 업그레이드 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ])("maps failed atomic creation safely without sending success notifications", async (error, message) => {
    rpc.mockResolvedValue({ data: null, error });
    await expect(createPartnerPlanUpgradeRequest(createInput)).rejects.toThrow(message);
    expectNoNotifications();
  });

  test.each(["request", "invoice", "payment", "taxDocument"])("rejects a receipt missing %s before notifying", async (key) => {
    rpc.mockResolvedValue({ data: { ...payload, [key]: null }, error: null });
    await expect(createPartnerPlanUpgradeRequest(createInput)).rejects.toThrow("확인하지 못했습니다.");
    expectNoNotifications();
  });

  test("keeps committed billing successful when both notifications fail", async () => {
    mocks.adminNotification.mockRejectedValue(new Error("admin delivery failed"));
    mocks.partnerNotification.mockRejectedValue(new Error("partner delivery failed"));
    await expect(createPartnerPlanUpgradeRequest(createInput)).resolves.toMatchObject({ id: "request-a" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(mocks.logError).toHaveBeenCalledTimes(2);
  });
});

describe("bank transfer confirmation", () => {
  test("passes administrator attribution and maps the committed payment/tax receipt", async () => {
    rpc.mockResolvedValue({ data: {
      invoice: { ...invoice, status: "paid", paid_at: NOW },
      payment: { status: "confirmed", confirmed_at: NOW },
      taxDocument: { status: "issued", issued_at: NOW },
    }, error: null });
    await expect(confirmPartnerPlanBankTransferPayment(confirmInput)).resolves.toEqual({
      id: "invoice-a", invoiceNumber: invoice.invoice_number, invoiceStatus: "paid", paymentStatus: "confirmed", taxDocumentStatus: "issued",
      billingPolicy: "first_month_full_amount", remainingDays: 30, servicePeriodStart: NOW, servicePeriodEnd: PERIOD_END,
      supplyAmountKrw: 45_455, vatAmountKrw: 4_545, totalAmountKrw: 50_000, dueAt: DUE, paidAt: NOW, paymentConfirmedAt: NOW, taxDocumentIssuedAt: NOW,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("confirm_partner_plan_bank_transfer_payment", {
      p_request_id: "request-a", p_admin_id: "admin-a", p_tax_document_status: "issued", p_confirmed_at: NOW,
    });
    expect(from).not.toHaveBeenCalled();
  });

  test.each([
    ["partner_plan_payment_request_state_conflict", "partner_company_plan_processed"],
    ["partner_plan_payment_invoice_not_found", "partner_company_plan_invoice_missing"],
    ["partner_plan_payment_invoice_cancelled", "partner_company_plan_invoice_cancelled"],
    ["private provider failure", "partner_company_plan_payment_confirm_failed"],
  ])("maps confirmation failure %s", async (token, message) => {
    rpc.mockResolvedValue({ data: null, error: { message: token } });
    await expect(confirmPartnerPlanBankTransferPayment(confirmInput)).rejects.toThrow(message);
  });

  test.each(["invoice", "payment", "taxDocument"])("rejects a confirmation receipt missing %s", async (key) => {
    rpc.mockResolvedValue({ data: { ...payload, [key]: null }, error: null });
    await expect(confirmPartnerPlanBankTransferPayment(confirmInput)).rejects.toThrow("확인하지 못했습니다.");
  });
});

describe("partner cancellation", () => {
  test("cancels an owned company request through one RPC without administrator attribution", async () => {
    await expect(cancelPartnerPlanUpgradeRequest(cancelInput)).resolves.toBeUndefined();
    expect(requestRead.eq).toHaveBeenCalledWith("id", "request-a");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("cancel_partner_plan_upgrade_billing", {
      p_request_id: "request-a", p_next_request_status: "cancelled", p_cancelled_at: NOW, p_admin_id: null, p_admin_note: null,
    });
  });

  test.each([
    [null, "업그레이드 요청을 찾을 수 없습니다."],
    [{ ...request, requested_by_account_id: "another-account" }, "업그레이드 요청을 찾을 수 없습니다."],
    [{ ...request, company_id: "another-company" }, "업그레이드 요청을 찾을 수 없습니다."],
    [{ ...request, status: "approved" }, "이미 처리된 업그레이드 요청입니다."],
  ])("blocks inaccessible or processed cancellation before mutation", async (row, message) => {
    requestRead.maybeSingle.mockResolvedValue({ data: row, error: null });
    await expect(cancelPartnerPlanUpgradeRequest(cancelInput)).rejects.toThrow(message);
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([
    ["partner_plan_cancel_request_state_conflict", "이미 처리된 업그레이드 요청입니다."],
    ["partner_plan_cancel_paid_invoice_conflict", "입금 확인이 완료된 청구는 취소할 수 없습니다."],
    ["private provider failure", "업그레이드 요청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ])("maps concurrent cancellation failure %s", async (token, message) => {
    rpc.mockResolvedValue({ data: null, error: { message: token } });
    await expect(cancelPartnerPlanUpgradeRequest(cancelInput)).rejects.toThrow(message);
  });
});

describe("administrator plan update", () => {
  test("preserves expected state and changes the plan before notifying the company", async () => {
    await updatePartnerBrandPlanByAdmin(updateInput);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("update_partner_brand_plan_by_admin", {
      p_partner_id: "partner-a", p_expected_plan_tier: "basic", p_expected_plan_updated_at: brand.plan_updated_at,
      p_next_plan_tier: "partner", p_plan_started_at: NOW, p_plan_expires_at: PERIOD_END,
      p_actor_admin_id: "admin-a", p_note: "관리자 변경", p_updated_at: NOW,
    });
    expect(mocks.partnerNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "plan_changed", companyId: "company-a", targetUrl: "/partner/companies/company-a/plans",
      templateContext: expect.objectContaining({ previousPlanName: "Basic", nextPlanName: "Partner", effectiveAt: NOW, expiresAt: PERIOD_END }),
    }));
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.partnerNotification.mock.invocationCallOrder[0]);
  });

  test("rejects an invalid window before the atomic update", async () => {
    await expect(updatePartnerBrandPlanByAdmin({ ...updateInput, planExpiresAt: "2026-10-16T03:00:00.000Z" })).rejects.toThrow("partner_company_plan_invalid_request");
    expect(rpc).not.toHaveBeenCalled();
    expectNoNotifications();
  });

  test.each([
    ["partner_plan_admin_update_state_changed", "partner_company_plan_state_changed"],
    ["partner_plan_admin_update_pending_request", "partner_company_plan_pending_exists"],
    ["private provider failure", "partner_company_plan_update_failed"],
  ])("does not notify after update failure %s", async (token, message) => {
    rpc.mockResolvedValue({ data: null, error: { message: token } });
    await expect(updatePartnerBrandPlanByAdmin(updateInput)).rejects.toThrow(message);
    expectNoNotifications();
  });

  test("logs notification failure without retrying a committed plan update", async () => {
    mocks.partnerNotification.mockRejectedValue(new Error("delivery failed"));
    await expect(updatePartnerBrandPlanByAdmin(updateInput)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(mocks.logError).toHaveBeenCalledWith("[partner-plan-service] plan change notification failed", expect.any(Error));
  });
});

describe("administrator upgrade review", () => {
  test("approves through the payment-guarded RPC and uses the committed invoice in the notification", async () => {
    const paidAt = "2026-10-16T03:00:00.000Z";
    rpc.mockResolvedValue({ data: { invoice: { ...invoice, status: "paid", paid_at: paidAt } }, error: null });
    await reviewPartnerPlanUpgradeRequest(reviewInput);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("approve_partner_plan_upgrade_request", {
      p_request_id: "request-a", p_admin_id: "admin-a", p_admin_note: "확인", p_reviewed_at: NOW,
    });
    expect(mocks.partnerNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "plan_upgrade_approved", accountIds: ["account-a"],
      templateContext: expect.objectContaining({ effectiveAt: paidAt, expiresAt: PERIOD_END }),
    }));
  });

  test("rejects through atomic cancellation and includes the normalized reason", async () => {
    await reviewPartnerPlanUpgradeRequest({ ...reviewInput, nextStatus: "rejected", adminNote: "  사업자 확인 필요  " });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("cancel_partner_plan_upgrade_billing", {
      p_request_id: "request-a", p_next_request_status: "rejected", p_cancelled_at: NOW, p_admin_id: "admin-a", p_admin_note: "사업자 확인 필요",
    });
    expect(mocks.partnerNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "plan_upgrade_rejected", templateContext: expect.objectContaining({ rejectionReason: "사업자 확인 필요" }),
    }));
  });

  test.each([
    [null, "partner_company_plan_missing_request"],
    [{ ...request, partner_id: null, brand: null }, "partner_company_plan_partner_missing"],
    [{ ...request, status: "cancelled" }, "partner_company_plan_processed"],
  ])("blocks missing or terminal requests before billing mutation", async (row, message) => {
    requestRead.maybeSingle.mockResolvedValue({ data: row, error: null });
    await expect(reviewPartnerPlanUpgradeRequest(reviewInput)).rejects.toThrow(message);
    expect(rpc).not.toHaveBeenCalled();
    expectNoNotifications();
  });

  test.each([
    ["partner_plan_approval_invoice_unpaid_conflict", "partner_company_plan_payment_unconfirmed"],
    ["partner_plan_approval_partner_state_conflict", "partner_company_plan_state_changed"],
    ["partner_plan_approval_request_state_conflict", "partner_company_plan_processed"],
    ["private provider failure", "partner_company_plan_approval_failed"],
  ])("does not send approval after atomic conflict %s", async (token, message) => {
    rpc.mockResolvedValue({ data: null, error: { message: token } });
    await expect(reviewPartnerPlanUpgradeRequest(reviewInput)).rejects.toThrow(message);
    expectNoNotifications();
  });

  test("does not send rejection when a payment was confirmed concurrently", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "partner_plan_cancel_paid_invoice_conflict" } });
    await expect(reviewPartnerPlanUpgradeRequest({ ...reviewInput, nextStatus: "rejected" })).rejects.toThrow("partner_company_plan_rejection_paid");
    expectNoNotifications();
  });

  test("rejects an approval receipt without its invoice before notifying", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await expect(reviewPartnerPlanUpgradeRequest(reviewInput)).rejects.toThrow("승인된 청구서를 확인하지 못했습니다.");
    expectNoNotifications();
  });

  test("keeps a completed review successful if its notification fails", async () => {
    mocks.partnerNotification.mockRejectedValue(new Error("delivery failed"));
    await expect(reviewPartnerPlanUpgradeRequest(reviewInput)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(mocks.logError).toHaveBeenCalledWith("[partner-plan-service] review notification failed", expect.any(Error));
  });
});

describe("overdue downgrade batch", () => {
  test("runs one bounded atomic batch and returns its validated summary", async () => {
    const results = [{ invoiceId: "invoice-a", partnerId: "partner-a", downgradedTo: "basic" }];
    rpc.mockResolvedValue({ data: { checked: "4", downgraded: "1", results }, error: null });
    await expect(runPartnerBillingOverdueDowngrades(new Date(NOW))).resolves.toEqual({ checked: 4, downgraded: 1, results });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("process_partner_billing_overdue_downgrades", { p_now: NOW, p_limit: 100 });
    expect(from).not.toHaveBeenCalled();
  });

  test("accepts an empty batch", async () => {
    rpc.mockResolvedValue({ data: { checked: 0, downgraded: 0, results: [] }, error: null });
    await expect(runPartnerBillingOverdueDowngrades()).resolves.toEqual({ checked: 0, downgraded: 0, results: [] });
  });

  test.each([
    null, {}, { checked: -1, downgraded: 0, results: [] }, { checked: 1.5, downgraded: 0, results: [] },
    { checked: 1, downgraded: 1, results: [] },
    { checked: 1, downgraded: 1, results: [{ invoiceId: "invoice-a", partnerId: "partner-a", downgradedTo: "boost" }] },
    { checked: 1, downgraded: 1, results: [{ invoiceId: null, partnerId: "partner-a", downgradedTo: "basic" }] },
  ])("rejects a malformed batch receipt %j", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(runPartnerBillingOverdueDowngrades()).rejects.toThrow("미납 플랜 자동 조정 결과를 확인하지 못했습니다.");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  test("logs transaction failure and returns a safe recoverable message without retrying", async () => {
    const error = { message: "private provider failure" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(runPartnerBillingOverdueDowngrades()).rejects.toThrow("미납 플랜 자동 조정을 완료하지 못했습니다.");
    expect(mocks.logError).toHaveBeenCalledWith("[partner-plan-service] overdue downgrade transaction failed", error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
