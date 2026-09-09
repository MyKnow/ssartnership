import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260831005738_make_partner_plan_billing_transitions_atomic.sql",
  import.meta.url,
);
const cancellationMigrationUrl = new URL(
  "../supabase/migrations/20260831013324_make_partner_plan_upgrade_cancellation_atomic.sql",
  import.meta.url,
);
const overdueLockMigrationUrl = new URL(
  "../supabase/migrations/20260831021445_fix_partner_billing_overdue_lock_order.sql",
  import.meta.url,
);
const billingPolicyUrl = new URL("../src/lib/partner-billing.ts", import.meta.url);
const serviceUrl = new URL(
  "../src/lib/partner-plan-service.ts",
  import.meta.url,
);
const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);

const migrationPromise = readFile(migrationUrl, "utf8");
const cancellationMigrationPromise = readFile(cancellationMigrationUrl, "utf8");
const overdueLockMigrationPromise = readFile(overdueLockMigrationUrl, "utf8");
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

function assertRequestInvoiceLockOrder(sql: string) {
  const requestLock = sql.indexOf(
    "from public.partner_plan_upgrade_requests",
  );
  const invoiceLock = sql.indexOf("from public.partner_billing_invoices");
  assert.ok(requestLock >= 0, "request row lock must exist");
  assert.ok(
    invoiceLock > requestLock,
    "request row must be locked before its billing invoice",
  );
}

function assertPartnerLockPrecedesDowngradeDecision(sql: string) {
  const partnerLock = sql.indexOf("from public.partners");
  const decision = sql.indexOf(
    "should_downgrade_partner := partner_row.plan_tier <> 'basic'",
  );
  assert.ok(partnerLock >= 0, "partner row lock must exist");
  assert.ok(decision > partnerLock, "partner row must be locked before downgrade decision");
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

    assert.match(
      sql,
      /from public\.partner_plan_upgrade_requests[\s\S]*for update;/i,
    );
    assert.match(sql, /request_row\.status <> 'pending'/i);
    assert.match(
      sql,
      /from public\.partner_billing_invoices[\s\S]*for update;/i,
    );
    assert.match(sql, /set status = 'paid'/i);
    assert.match(sql, /set status = 'confirmed'/i);
    assert.match(sql, /target_tax_document_status := case/i);
    assert.match(
      sql,
      /when tax_document_row\.status = 'issued' then 'issued'/i,
    );
    assert.match(sql, /coalesce\(paid_at, p_confirmed_at\)/i);
    assert.match(sql, /partner_plan_payment_record_not_found/i);
    assertRequestInvoiceLockOrder(sql);
  });

  it("processes each overdue batch as one guarded transition", async () => {
    const [migration, billingPolicySource] = await Promise.all([
      overdueLockMigrationPromise,
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

    assert.match(sql, /for update skip locked/i);
    assert.match(sql, gracePeriodPattern);
    assert.match(sql, /from public\.partners[\s\S]*for update;/i);
    assert.match(sql, /request_row\.status <> 'pending'[\s\S]*continue;/i);
    const lockedTransition = sql.slice(sql.indexOf("loop"));
    assertRequestInvoiceLockOrder(lockedTransition);
    const invoiceLock = lockedTransition.indexOf("from public.partner_billing_invoices");
    const partnerLock = lockedTransition.indexOf("from public.partners");
    assert.ok(partnerLock > invoiceLock);
    assertPartnerLockPrecedesDowngradeDecision(lockedTransition);
    assert.match(
      sql,
      /should_downgrade_partner := partner_row\.plan_tier <> 'basic'[\s\S]*partner_row\.plan_tier is not distinct from request_row\.current_plan_tier/i,
    );
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
    assert.match(
      sql,
      /from public\.partner_tax_documents[\s\S]*status in \('requested', 'pending_issue'\)[\s\S]*for update;/i,
    );
    assert.match(sql, /update public\.partner_plan_upgrade_requests/i);
    assert.match(sql, /insert into public\.partner_brand_plan_events/i);
    assert.match(sql, /previous_plan_tier,[\s\S]*partner_row\.plan_tier,/i);
    assert.match(
      sql,
      /if should_downgrade_partner then[\s\S]*insert into public\.partner_brand_plan_events/i,
    );
  });

  it("routes all three service mutations through the atomic RPC contracts", async () => {
    const service = await servicePromise;
    const createSource = getServiceFunction(
      service,
      "createPartnerPlanUpgradeRequest",
      "export async function confirmPartnerPlanBankTransferPayment",
    );
    const confirmSource = getServiceFunction(
      service,
      "confirmPartnerPlanBankTransferPayment",
      "export async function cancelPartnerPlanUpgradeRequest",
    );
    const cancelSource = getServiceFunction(
      service,
      "cancelPartnerPlanUpgradeRequest",
      "export async function updatePartnerBrandPlanByAdmin",
    );
    const adminUpdateSource = getServiceFunction(
      service,
      "updatePartnerBrandPlanByAdmin",
      "export async function reviewPartnerPlanUpgradeRequest",
    );
    const reviewSource = getServiceFunction(
      service,
      "reviewPartnerPlanUpgradeRequest",
      "export async function runPartnerBillingOverdueDowngrades",
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
      cancelSource,
      /\.rpc\(\s*"cancel_partner_plan_upgrade_billing"/i,
    );
    assert.match(
      adminUpdateSource,
      /\.rpc\(\s*"update_partner_brand_plan_by_admin"/i,
    );
    assert.match(adminUpdateSource, /p_expected_plan_tier: input\.expectedPlanTier/i);
    assert.match(
      adminUpdateSource,
      /p_expected_plan_updated_at: input\.expectedPlanUpdatedAt/i,
    );
    assert.doesNotMatch(
      adminUpdateSource,
      /\.from\("partners"\)\.update/i,
    );
    assert.doesNotMatch(
      adminUpdateSource,
      /\.from\("partner_brand_plan_events"\)\.insert/i,
    );
    assert.match(
      reviewSource,
      /\.rpc\(\s*"approve_partner_plan_upgrade_request"/i,
    );
    assert.match(
      reviewSource,
      /\.rpc\(\s*"cancel_partner_plan_upgrade_billing"/i,
    );
    assert.doesNotMatch(
      reviewSource,
      /\.from\("partner_plan_upgrade_requests"\)\.update/i,
    );
    assert.doesNotMatch(
      reviewSource,
      /\.from\("partners"\)\.update/i,
    );
    assert.doesNotMatch(
      reviewSource,
      /\.from\("partner_brand_plan_events"\)\.insert/i,
    );
    assert.match(
      overdueSource,
      /\.rpc\(\s*"process_partner_billing_overdue_downgrades"/i,
    );
    assert.doesNotMatch(overdueSource, /Promise\.all/i);
  });

  it("cancels partner plan requests and pending billing rows atomically", async () => {
    const migration = await cancellationMigrationPromise;
    const sql = getFunctionSql(
      migration,
      "cancel_partner_plan_upgrade_billing",
    );

    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = pg_catalog, public/i);
    assert.match(
      sql,
      /from public\.partner_plan_upgrade_requests[\s\S]*for update;/i,
    );
    assert.match(
      sql,
      /p_next_request_status not in \('rejected', 'cancelled'\)/i,
    );
    assert.match(
      sql,
      /p_next_request_status = 'rejected' and p_admin_id is null/i,
    );
    assert.match(sql, /invoice_row\.status = 'paid'/i);
    assert.match(sql, /update public\.partner_plan_upgrade_requests/i);
    assert.match(sql, /update public\.partner_billing_invoices/i);
    assert.match(sql, /update public\.partner_billing_payments/i);
    assert.match(sql, /update public\.partner_tax_documents/i);
    assertRequestInvoiceLockOrder(sql);
    assert.match(
      migration,
      /grant execute on function public\.cancel_partner_plan_upgrade_billing\([\s\S]*to service_role;/i,
    );
  });

  it("atomically applies administrator partner plan changes with an event insert", async () => {
    const migration = await cancellationMigrationPromise;
    const sql = getFunctionSql(
      migration,
      "update_partner_brand_plan_by_admin",
    );

    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = pg_catalog, public/i);
    assert.match(sql, /p_next_plan_tier not in \('basic', 'partner', 'boost'\)/i);
    assert.match(sql, /from public\.partners[\s\S]*for update;/i);
    assert.match(sql, /partner_plan_admin_update_partner_not_found/i);
    assert.match(sql, /partner_plan_admin_update_company_required/i);
    assert.match(
      sql,
      /partner_row\.plan_tier is distinct from p_expected_plan_tier/i,
    );
    assert.match(
      sql,
      /partner_row\.plan_updated_at is distinct from p_expected_plan_updated_at/i,
    );
    assert.match(sql, /partner_plan_admin_update_state_changed/i);
    assert.match(
      sql,
      /from public\.partner_plan_upgrade_requests as request[\s\S]*request\.status = 'pending'/i,
    );
    assert.match(sql, /partner_plan_admin_update_pending_request/i);
    assert.match(
      sql,
      /p_plan_expires_at is not null[\s\S]*p_plan_expires_at <= p_plan_started_at/i,
    );
    assert.match(sql, /partner_plan_admin_update_invalid_window/i);
    assert.match(sql, /update public\.partners/i);
    assert.match(sql, /insert into public\.partner_brand_plan_events/i);
    assert.match(
      migration,
      /grant execute on function public\.update_partner_brand_plan_by_admin\([\s\S]*to service_role;/i,
    );
  });

  it("approves paid upgrade requests with partner and event updates in one transaction", async () => {
    const migration = await cancellationMigrationPromise;
    const sql = getFunctionSql(
      migration,
      "approve_partner_plan_upgrade_request",
    );

    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = pg_catalog, public/i);
    assert.match(
      sql,
      /from public\.partner_plan_upgrade_requests[\s\S]*for update;/i,
    );
    assert.match(
      sql,
      /from public\.partner_billing_invoices[\s\S]*for update;/i,
    );
    assert.match(
      sql,
      /invoice_row\.status <> 'paid'/i,
    );
    assert.match(
      sql,
      /from public\.partners[\s\S]*for update;/i,
    );
    assert.match(sql, /update public\.partner_plan_upgrade_requests/i);
    assert.match(sql, /set status = 'approved'/i);
    assert.match(sql, /update public\.partners/i);
    assert.match(sql, /insert into public\.partner_brand_plan_events/i);
    assert.match(sql, /partner_plan_approval_request_state_conflict/i);
    assert.match(sql, /partner_plan_approval_invoice_not_found/i);
    assert.match(sql, /partner_plan_approval_invoice_unpaid_conflict/i);
    assert.match(sql, /partner_row\.plan_tier is distinct from request_row\.current_plan_tier/i);
    assert.match(sql, /partner_plan_approval_partner_state_conflict/i);
    assertRequestInvoiceLockOrder(sql);
    assert.match(
      migration,
      /grant execute on function public\.approve_partner_plan_upgrade_request\([\s\S]*to service_role;/i,
    );
  });

  it("keeps the schema snapshot identical to the forward migration contract", async () => {
    const [migration, cancellationMigration, overdueLockMigration, schema] = await Promise.all([
      migrationPromise,
      cancellationMigrationPromise,
      overdueLockMigrationPromise,
      schemaPromise,
    ]);
    assert.ok(schema.includes(migration.trim()));
    assert.ok(schema.includes(cancellationMigration.trim()));
    assert.ok(schema.includes(overdueLockMigration.trim()));
  });

  it("keeps administrator attribution on member-backed session identifiers", async () => {
    const schema = await schemaPromise;
    for (const [table, column] of [
      ["partner_plan_upgrade_requests", "reviewed_by_admin_id"],
      ["partner_brand_plan_events", "actor_admin_id"],
      ["partner_billing_payments", "confirmed_by_admin_id"],
      ["partner_tax_documents", "issued_by_admin_id"],
    ] as const) {
      const tableSql = schema.slice(
        schema.indexOf(`create table if not exists ${table}`),
        schema.indexOf(";", schema.indexOf(`create table if not exists ${table}`)),
      );
      assert.match(
        tableSql,
        new RegExp(`${column} uuid references members\\(id\\)`, "i"),
      );
    }
  });
});
