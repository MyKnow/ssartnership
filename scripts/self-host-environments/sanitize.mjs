import { randomBytes } from "node:crypto";
import { fail } from "./lib.mjs";

// Reviewed public table inventory at migration 199. New tables fail closed:
// their rows must not silently become part of a real-data Preview copy.
const TABLES = new Set(`ad_campaigns ad_coupon_codes ad_coupon_issues ad_coupon_redemptions ad_coupons admin_accounts admin_audit_logs admin_login_attempts admin_notification_deliveries admin_notification_preferences admin_notification_recipients admin_notifications admin_permission_templates admin_permissions admin_profiles admin_push_subscriptions apple_wallet_device_registrations auth_security_logs categories event_logs event_reward_draws event_reward_winners graduate_email_challenges graduate_profiles graduate_verification_requests graduate_verification_uploads image_asset_migrations image_upload_quota_windows image_upload_sessions log_retention_holds manual_member_import_batches manual_member_import_rows mattermost_sender_credentials mattermost_sender_test_attempts mattermost_verification_codes member_auth_attempts member_email_challenges member_email_login_transitions member_identifier_reservations member_mattermost_disabled_generations member_notifications member_password_action_tokens member_policy_consents member_profile_images member_signup_approval_requests member_ssafy_verifications member_wallet_pass_operations member_wallet_pass_revisions member_wallet_passes members mm_user_directory notification_deliveries notification_templates notifications operational_notification_dedupes partner_account_companies partner_accounts partner_auth_attempts partner_benefit_usages partner_benefits partner_billing_invoices partner_billing_payments partner_billing_profiles partner_brand_plan_events partner_brand_profiles partner_change_requests partner_companies partner_company_branches partner_favorites partner_metric_rollups partner_metric_unique_visitors partner_notification_deliveries partner_notification_preferences partner_notification_recipients partner_notifications partner_offer_branches partner_plan_upgrade_requests partner_preview_tokens partner_publication_notification_states partner_push_subscriptions partner_registration_attempts partner_registration_benefit_groups partner_registration_branches partner_registration_requests partner_review_reactions partner_reviews partner_tax_documents partners password_reset_attempts platform_active_identities policy_documents promotion_events promotion_slides public_cache_versions push_delivery_logs push_message_logs push_preferences push_subscriptions ssafy_cohort_card_themes ssafy_cycle_settings suggestion_attempts`.split(" "));
const EMPTY = new Set(`admin_audit_logs admin_login_attempts admin_notification_deliveries admin_push_subscriptions apple_wallet_device_registrations auth_security_logs event_logs graduate_email_challenges graduate_verification_uploads image_asset_migrations image_upload_quota_windows log_retention_holds mattermost_sender_credentials mattermost_sender_test_attempts mattermost_verification_codes member_auth_attempts member_email_challenges member_email_login_transitions member_identifier_reservations member_password_action_tokens member_wallet_pass_operations member_wallet_pass_revisions member_wallet_passes notification_deliveries operational_notification_dedupes partner_auth_attempts partner_metric_unique_visitors partner_notification_deliveries partner_preview_tokens partner_push_subscriptions partner_registration_attempts password_reset_attempts platform_active_identities push_delivery_logs push_message_logs push_subscriptions suggestion_attempts`.split(" "));
const SECRET_COLUMNS = new Set(`password_hash password_salt avatar_base64 initial_setup_token_hash onsite_password_hash onsite_password_salt onsite_password_hash_snapshot onsite_password_salt_snapshot benefit_verification_pin_hash benefit_verification_pin_salt`.split(" "));
const quote = value => { if (!/^[a-z_][a-z0-9_]*$/u.test(value)) fail("CATALOG_IDENTIFIER_INVALID"); return `"${value}"`; };
const literal = value => `'${value.replaceAll("'", "''")}'`;

export function validateSnapshotLedger(ledger, plan) {
  // Advancing the Production source schema requires a copy-policy review;
  // accepting another migration checksum alone is insufficient. Dev may lead.
  if (!Array.isArray(ledger) || ledger.length === 0 || ledger.length > 199 || ledger.length > plan.length
    || ledger.some((item, i) => item.name !== plan[i].name || item.checksum !== plan[i].checksum)) fail("SNAPSHOT_LEDGER_NOT_REVIEWED_PREFIX");
}

/** Runs ONLY inside a no-network disposable restore, never against Production. */
export function buildSanitizationSql(catalog, { sourceStorageOrigin, targetStorageOrigin } = {}) {
  const maskingSalt = randomBytes(32).toString("hex");
  const tables = new Set(catalog.map(c => c.table));
  for (const table of tables) if (!TABLES.has(table)) fail("UNREVIEWED_TABLE");
  const sql = ["BEGIN;", "SET LOCAL session_replication_role = replica;"];
  const updates = new Map();
  const assign = (table, column, value) => {
    if (!updates.has(table)) updates.set(table, []);
    updates.get(table).push(`${quote(column)} = ${value}`);
  };
  const rewrites = [];
  for (const table of tables) if (EMPTY.has(table)) sql.push(`DELETE FROM public.${quote(table)};`);
  for (const { table, column, nullable, dataType, udt } of catalog) {
    quote(table); quote(column);
    if (EMPTY.has(table)) continue;
    if (SECRET_COLUMNS.has(column)) {
      // Required partner/admin hashes are replaced by a fresh, undisclosed
      // sentinel. No Production credential is exported, including old hashes.
      const sentinel = literal(randomBytes(64).toString("hex"));
      const value = table === "member_signup_approval_requests" && column.startsWith("password_")
        ? `CASE WHEN ${quote(column)} IS NULL THEN NULL ELSE ${sentinel} END`
        : nullable ? "NULL" : sentinel;
      assign(table, column, value);
    } else if (column !== "must_change_password" && /password|token|secret|credential|ciphertext|nonce|auth_tag/u.test(column)) {
      fail("UNREVIEWED_SECRET_COLUMN");
    }
    if (/email/u.test(column) && ["email", "email_normalized", "contact_email", "tax_invoice_email", "candidate_email", "candidate_email_normalized"].includes(column)) {
      assign(table, column, `'preview-' || md5(lower(trim(${quote(column)})) || ${literal(maskingSalt)}) || '@preview.invalid'`);
    }
    if (["ip_address", "consent_ip_address", "user_agent", "consent_user_agent"].includes(column) && nullable) assign(table, column, "NULL");
    if (["auth_session_version", "permission_version"].includes(column)) assign(table, column, `${quote(column)} + 1`);
    if (column === "must_change_password") assign(table, column, "true");
    // Fixed source origin replacement only; never retain production Storage
    // references in arrays/JSON/business text after copying the actual files.
    if (sourceStorageOrigin && targetStorageOrigin && (["text", "jsonb"].includes(dataType) || (dataType === "ARRAY" && udt === "_text"))) {
      const source = `${new URL(sourceStorageOrigin).origin}/storage/v1/`;
      const target = `${new URL(targetStorageOrigin).origin}/storage/v1/`;
      const cast = dataType === "ARRAY" ? "text[]" : dataType;
      rewrites.push(`UPDATE public.${quote(table)} SET ${quote(column)} = replace(${quote(column)}::text, ${literal(source)}, ${literal(target)})::${cast} WHERE ${quote(column)}::text LIKE ${literal(`%${source}%`)};`);
    }
  }
  // Password pairs and email/normalized-email CHECKs must see one atomic row
  // update. Disabling triggers does NOT disable CHECK constraints.
  for (const [table, assignments] of updates) sql.push(`UPDATE public.${quote(table)} SET ${assignments.join(", ")};`);
  sql.push(...rewrites, "COMMIT;");
  return `${sql.join("\n")}\n`;
}

export function storageObjectPath({ bucket_id: bucket, name, version }) {
  if (typeof bucket !== "string" || !/^[a-zA-Z0-9_-]+$/u.test(bucket) || typeof name !== "string" || name.length > 1024
    || /[\\\u0000-\u001f\u007f]/u.test(name) || name.split("/").some(p => !p || p === "." || p === "..")
    || !/^[a-f0-9-]{36}$/u.test(version)) fail("STORAGE_PATH_INVALID");
  return `stub/stub/${bucket}/${name}/${version}`;
}
