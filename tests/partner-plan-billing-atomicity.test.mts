import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260831005738_make_partner_plan_billing_transitions_atomic.sql",
  import.meta.url,
);
const billingPolicyUrl = new URL("../src/lib/partner-billing.ts", import.meta.url);
const serviceUrl = new URL(
  "../src/lib/partner-plan-service.ts",
  import.meta.url,
);
const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);

const migrationPromise = readFile(migrationUrl, "utf8");
const billingPolicyPromise = readFile(billingPolicyUrl, "utf8");
const servicePromise = readFile(serviceUrl, "utf8");
const schemaPromise = readFile(schemaUrl, "utf8");

function getFunctionSql(sql: string, functionName: string) {
  const start = sql.indexOf(
    `create or replace function public.${functionName}(`,
  );
  assert.notEqual(start, -1, `${functionName} must exist`);
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `${functionName} must terminate`);
  return sql.slice(start, end + 4);
}

function getServiceFunction(
  source: string,
  functionName: string,
  nextMarker: string,
) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const end = source.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `${functionName} must have a boundary`);
  return source.slice(start, end);
}

function getPolicyNumber(source: string, fieldName: string) {
  const pattern = new RegExp(`${fieldName}:\\s*(\\d+)`);
  const match = source.match(pattern);
  assert.ok(match, `${fieldName} must exist`);
  return Number(match[1]);
}

describe("atomic partner plan billing transitions", () => {
  it("creates the request and all billing records in one locked service-role RPC", async () => {
    const migration = await migrationPromise;
    const sql = getFunctionSql(
      migration,
      "create_partner_plan_upgrade_billing",
    );

    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = pg_catalog, public/i);
    assert.match(sql, /from public\.partners[\s\S]*for update;/i);
    assert.match(
      sql,
      /from public\.partner_billing_profiles[\s\S]*for update;/i,
    );
    assert.match(
      sql,
      /plan_updated_at is distinct from p_expected_plan_updated_at/i,
    );
    assert.match(sql, /insert into public\.partner_plan_upgrade_requests/i);
    assert.match(sql, /insert into public\.partner_billing_invoices/i);
    assert.match(sql, /insert into public\.partner_billing_payments/i);
    assert.match(sql, /insert into public\.partner_tax_documents/i);
    assert.match(sql, /set billing_invoice_id = invoice_row\.id/i);
    assert.match(
      migration,
      /revoke all on function public\.create_partner_plan_upgrade_billing\([\s\S]*from anon;/i,
    );
    assert.match(
      migration,
      /revoke all on function public\.create_partner_plan_upgrade_billing\([\s\S]*from authenticated;/i,
    );
    assert.match(
      migration,
      /grant execute on function public\.create_partner_plan_upgrade_billing\([\s\S]*to service_role;/i,
    );
  });

  it("confirms invoice, payment, and tax document atomically and idempotently", async () => {
    const migration = await migrationPromise;
    const sql = getFunctionSql(
      migration,
      "confirm_partner_plan_bank_transfer_payment",
    );

    assert.match(sql, /for update of invoice;/i);
    assert.match(sql, /set status = 'paid'/i);
    assert.match(sql, /set status = 'confirmed'/i);
    assert.match(sql, /target_tax_document_status := case/i);
    assert.match(
      sql,
      /when tax_document_row\.status = 'issued' then 'issued'/i,
    );
    assert.match(sql, /coalesce\(paid_at, p_confirmed_at\)/i);
    assert.match(sql, /partner_plan_payment_record_not_found/i);
  });

  it("processes each overdue batch as one guarded transition", async () => {
    const [migration, billingPolicySource] = await Promise.all([
      migrationPromise,
      billingPolicyPromise,
    ]);
    const sql = getFunctionSql(
      migration,
      "process_partner_billing_overdue_downgrades",
    );
    const graceDays = getPolicyNumber(
      billingPolicySource,
      "unpaidDowngradeGraceDays",
    );
    const gracePeriodPattern = new RegExp(
      String.raw`invoice_row\.due_at \+ interval '${graceDays} days' > p_now`,
      "i",
    );

    assert.match(sql, /limit normalized_limit\s+for update skip locked/i);
    assert.match(sql, gracePeriodPattern);
    assert.match(sql, /from public\.partners[\s\S]*for update;/i);
    assert.match(sql, /request_row\.status <> 'pending'[\s\S]*continue;/i);
    assert.match(
      sql,
      /from public\.partner_billing_payments[\s\S]*status = 'awaiting_transfer'[\s\S]*for update;/i,
    );
    assert.match(
      sql,
      /from public\.partner_tax_documents[\s\S]*for update;/i,
    );
    assert.match(sql, /if not found then\s+continue;/i);
    assert.match(sql, /update public\.partners/i);
    assert.match(sql, /update public\.partner_billing_invoices/i);
    assert.match(sql, /update public\.partner_billing_payments/i);
    assert.match(sql, /update public\.partner_tax_documents/i);
    assert.match(sql, /update public\.partner_plan_upgrade_requests/i);
    assert.match(sql, /insert into public\.partner_brand_plan_events/i);
  });

  it("routes all three service mutations through the atomic RPC contracts", async () => {
    const service = await servicePromise;
    const createSource = getServiceFunction(
      service,
      "createPartnerPlanUpgradeRequest",
      "async function cancelBillingForUpgradeRequest",
    );
    const confirmSource = getServiceFunction(
      service,
      "confirmPartnerPlanBankTransferPayment",
      "export async function cancelPartnerPlanUpgradeRequest",
    );
    const overdueSource = service.slice(
      service.indexOf(
        "export async function runPartnerBillingOverdueDowngrades",
      ),
    );

    assert.match(
      createSource,
      /\.rpc\(\s*"create_partner_plan_upgrade_billing"/i,
    );
    assert.doesNotMatch(
      createSource,
      /\.from\("partner_billing_invoices"\)\.insert/i,
    );
    assert.match(
      confirmSource,
      /\.rpc\(\s*"confirm_partner_plan_bank_transfer_payment"/i,
    );
    assert.match(
      overdueSource,
      /\.rpc\(\s*"process_partner_billing_overdue_downgrades"/i,
    );
    assert.doesNotMatch(overdueSource, /Promise\.all/i);
  });

  it("keeps the schema snapshot identical to the forward migration contract", async () => {
    const [migration, schema] = await Promise.all([
      migrationPromise,
      schemaPromise,
    ]);
    assert.ok(schema.includes(migration.trim()));
  });
});
