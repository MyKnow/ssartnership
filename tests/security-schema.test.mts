import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const sensitiveTables = [
  "admin_login_attempts",
  "suggestion_attempts",
  "member_auth_attempts",
  "public_cache_versions",
  "partner_companies",
  "partner_accounts",
  "partner_account_companies",
  "partner_auth_attempts",
  "partner_change_requests",
  "partner_reviews",
  "partner_review_reactions",
  "partner_favorites",
  "members",
  "policy_documents",
  "member_policy_consents",
  "mm_user_directory",
  "password_reset_attempts",
  "push_preferences",
  "notifications",
  "member_notifications",
  "notification_deliveries",
  "push_subscriptions",
  "push_message_logs",
  "push_delivery_logs",
  "event_logs",
  "partner_metric_rollups",
  "partner_metric_unique_visitors",
  "ad_campaigns",
  "ad_coupons",
  "ad_coupon_redemptions",
  "admin_accounts",
  "admin_permissions",
  "admin_permission_templates",
  "admin_audit_logs",
  "auth_security_logs",
] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("sensitive public tables keep row level security enabled", () => {
  for (const tableName of sensitiveTables) {
    const pattern = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?${escapeRegex(tableName)}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
      "i",
    );

    assert.match(schemaSql, pattern, `${tableName} must enable RLS`);
  }
});

test("sensitive public tables revoke broad anon and authenticated access", () => {
  for (const tableName of sensitiveTables) {
    for (const role of ["anon", "authenticated"] as const) {
      const pattern = new RegExp(
        `revoke\\s+all\\s+on\\s+table\\s+(?:public\\.)?${escapeRegex(tableName)}\\s+from\\s+${role}\\s*;`,
        "i",
      );

      assert.match(schemaSql, pattern, `${tableName} must revoke ${role}`);
    }
  }
});
