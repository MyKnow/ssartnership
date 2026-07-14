import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const sensitiveTables = [
  "admin_login_attempts",
  "ssafy_cohort_card_themes",
  "suggestion_attempts",
  "partner_registration_attempts",
  "partner_registration_requests",
  "member_auth_attempts",
  "public_cache_versions",
  "partner_companies",
  "partner_accounts",
  "partner_account_companies",
  "partner_plan_upgrade_requests",
  "partner_brand_plan_events",
  "partner_billing_profiles",
  "partner_billing_invoices",
  "partner_billing_payments",
  "partner_tax_documents",
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
  "graduate_verification_requests",
  "member_profile_images",
  "graduate_email_challenges",
  "graduate_verification_uploads",
  "member_password_action_tokens",
  "manual_member_import_batches",
  "manual_member_import_rows",
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

test("수료증·본인 사진·수동 가져오기 staging bucket은 공개 Storage로 만들지 않는다", () => {
  for (const bucket of ["graduate-certificates", "member-profile-images", "manual-member-import-staging"]) {
    const pattern = new RegExp(
      `\\(\\s*'${escapeRegex(bucket)}',\\s*'${escapeRegex(bucket)}',\\s*false(?:,|\\))`,
      "i",
    );
    assert.match(schemaSql, pattern, `${bucket} must remain private`);
  }
});

test("수동 가져오기 staging과 설정 토큰은 서버 전용 제약을 둔다", () => {
  assert.match(schemaSql, /'manual-member-import-staging',\s*'manual-member-import-staging',\s*false,\s*5242880/i);
  assert.match(schemaSql, /manual_member_mm_lookup_generations/i);
  assert.match(schemaSql, /'manual_admin'/i);
  assert.match(schemaSql, /'manual_initial_setup',\s*'manual_password_reset'/i);
  assert.match(schemaSql, /create\s+or\s+replace\s+function\s+public\.complete_manual_member_password_action/i);
  assert.match(schemaSql, /grant\s+execute\s+on\s+function\s+public\.complete_manual_member_password_action\([^;]+to\s+service_role/i);
});

test("수료증과 본인 사진 bucket은 Storage 단계에서도 형식과 크기를 제한한다", () => {
  assert.match(
    schemaSql,
    /\(\s*'graduate-certificates',\s*'graduate-certificates',\s*false,\s*10485760,\s*array\['application\/pdf'\]/i,
  );
  assert.match(
    schemaSql,
    /\(\s*'member-profile-images',\s*'member-profile-images',\s*false,\s*5242880,\s*array\['image\/jpeg',\s*'image\/png',\s*'image\/webp'\]/i,
  );
});

test("수료생 인증 상태 전이는 데이터베이스에서도 강제한다", () => {
  assert.match(
    schemaSql,
    /create\s+or\s+replace\s+function\s+public\.enforce_graduate_verification_status_transition\(\)/i,
  );
  assert.match(
    schemaSql,
    /invalid_graduate_verification_status_transition/i,
  );
  assert.match(
    schemaSql,
    /create\s+trigger\s+graduate_verification_requests_status_transition/i,
  );
});

test("수료생 검토자는 현재 관리자 회원 식별자를 참조한다", () => {
  for (const tableName of [
    "graduate_verification_requests",
    "member_profile_images",
  ]) {
    const tableSection = schemaSql.match(
      new RegExp(
        `create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${tableName}\\s*\\([\\s\\S]*?\\n\\);`,
        "i",
      ),
    )?.[0];

    assert.ok(tableSection, `${tableName} table definition must exist`);
    assert.match(
      tableSection,
      /reviewer_admin_id\s+uuid\s+references\s+public\.members\(id\)\s+on\s+delete\s+set\s+null/i,
    );
  }
});

test("수료증 파일 해시는 활성 신청과 승인 상태에서 중복될 수 없다", () => {
  assert.match(
    schemaSql,
    /create\s+unique\s+index\s+if\s+not\s+exists\s+graduate_verification_requests_active_certificate_sha256_idx/i,
  );
  assert.match(
    schemaSql,
    /certificate_sha256[\s\S]*status\s+in\s+\('submitted',\s*'in_review',\s*'needs_resubmission',\s*'approved'\)/i,
  );
});

test("수료생 초기 비밀번호 설정 메일 재발송 RPC는 서비스 역할로만 호출한다", () => {
  assert.match(
    schemaSql,
    /create\s+or\s+replace\s+function\s+public\.reissue_graduate_initial_setup\(/i,
  );
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      schemaSql,
      new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.reissue_graduate_initial_setup\\([^;]+from\\s+${role}\\s*;`,
        "i",
      ),
    );
  }
  assert.match(
    schemaSql,
    /grant\s+execute\s+on\s+function\s+public\.reissue_graduate_initial_setup\([^;]+to\s+service_role\s*;/i,
  );
});
