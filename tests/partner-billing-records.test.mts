import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const invoiceNumber = await import("../src/lib/partner-billing-invoice-number.ts");
const root = new URL("..", import.meta.url);
const MIGRATION = "20261005030746_harden_privileges_retention_and_lifecycle.sql";

async function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("청구서 번호의 날짜는 KST 기준이다", () => {
  // 00:00-08:59 KST is still the previous UTC day.
  assert.equal(invoiceNumber.formatPartnerBillingInvoiceDate("2026-10-04T15:30:00.000Z"), "20261005");
  assert.equal(invoiceNumber.formatPartnerBillingInvoiceDate("2026-10-04T14:59:59.999Z"), "20261004");
  assert.equal(invoiceNumber.formatPartnerBillingInvoiceDate("2026-12-31T15:00:00.000Z"), "20270101");
  const value = invoiceNumber.createPartnerBillingInvoiceNumber(
    "2026-10-04T23:00:00.000Z",
    "8f14e45f-ceea-467a-9b0e-5d1c3b1a2f3e",
  );
  assert.equal(value, "SSP-20261005-8F14E45F");
  assert.match(value, /^SSP-[0-9]{8}-[0-9A-F]{8}$/u);
  assert.throws(() => invoiceNumber.formatPartnerBillingInvoiceDate("not-a-date"));
  assert.throws(() => invoiceNumber.createPartnerBillingInvoiceNumber("2026-10-04T23:00:00.000Z", "zz"));
});

test("청구서 발행일 기본값도 KST 날짜이고 서비스는 공용 번호 생성기를 쓴다", async () => {
  const [migration, service] = await Promise.all([
    read(`supabase/migrations/${MIGRATION}`),
    read("src/lib/partner-plan-service.ts"),
  ]);
  assert.match(
    migration,
    /alter table public\.partner_billing_invoices\s+alter column issue_date set default \(\(now\(\) at time zone 'Asia\/Seoul'\)::date\);/u,
  );
  assert.match(service, /p_invoice_number: createPartnerBillingInvoiceNumber\(nowIso, randomUUID\(\)\)/u);
  assert.doesNotMatch(service, /nowIso\.slice\(0, 10\)/u);
});

test("청구서·혜택 이용·쿠폰 사용 기록은 제휴처·파트너사 삭제로 함께 지워지지 않는다", async () => {
  const [migration, catalogActions, errors] = await Promise.all([
    read(`supabase/migrations/${MIGRATION}`),
    read("src/app/admin/(protected)/_actions/catalog-actions.ts"),
    read("src/lib/admin-action-errors.ts"),
  ]);
  for (const [table, column, referenced] of [
    ["partner_billing_invoices", "partner_id", "partners"],
    ["partner_billing_invoices", "company_id", "partner_companies"],
    ["partner_benefit_usages", "partner_id", "partners"],
    ["ad_coupon_redemptions", "partner_id", "partners"],
  ]) {
    assert.match(migration, new RegExp(`\\('${table}', '${column}', '${referenced}'\\)`, "u"));
  }
  assert.match(migration, /references public\.%I\(id\) on delete restrict'/u);
  assert.match(catalogActions, /deleteError\.code === "23503" \? "company_has_billing_records" : "company_invalid_request"/u);
  assert.match(errors, /company_has_billing_records:\s+"청구·결제 기록이 있는 파트너사는 삭제할 수 없습니다\./u);
});
