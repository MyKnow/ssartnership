const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Invoices are issued in Korea, so the number's date follows KST like
 * `partner_billing_invoices.issue_date` (00:00-08:59 KST is still the previous
 * UTC day).
 */
export function formatPartnerBillingInvoiceDate(nowIso: string) {
  const timestamp = Date.parse(nowIso);
  if (!Number.isFinite(timestamp)) {
    throw new Error("청구서 발행 시각을 확인해 주세요.");
  }
  return new Date(timestamp + KST_OFFSET_MS).toISOString().slice(0, 10).replaceAll("-", "");
}

/** `SSP-YYYYMMDD-XXXXXXXX`, the format the billing RPC accepts. */
export function createPartnerBillingInvoiceNumber(nowIso: string, uniqueId: string) {
  const suffix = uniqueId.replaceAll("-", "").slice(0, 8).toUpperCase();
  if (!/^[0-9A-F]{8}$/u.test(suffix)) {
    throw new Error("청구서 번호를 만들지 못했습니다.");
  }
  return `SSP-${formatPartnerBillingInvoiceDate(nowIso)}-${suffix}`;
}
