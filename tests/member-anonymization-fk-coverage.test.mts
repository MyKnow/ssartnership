import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

// members rows are anonymized in place, so FK cascades never run on that path.
// Every column that references members(id) must be either cleared by
// anonymize_deleted_member() or retained here with a reason. A new member FK
// fails this test until it is classified.
const root = new URL("..", import.meta.url);
const MEMBER_REFERENCE = String.raw`references\s+(?:public\.)?members\s*\(\s*id\s*\)`;

const CLEARED_BY_ANONYMIZATION = [
  "admin_notification_deliveries.admin_id",
  "admin_notification_preferences.admin_id",
  "admin_notification_recipients.admin_id",
  "admin_push_subscriptions.admin_id",
  "event_reward_winners.member_id",
  "graduate_profiles.member_id",
  "graduate_verification_requests.recovery_member_id",
  "graduate_verification_uploads.member_id",
  "manual_member_import_rows.member_id",
  "member_email_challenges.member_id",
  "member_email_login_transitions.member_id",
  "member_notifications.member_id",
  "member_password_action_tokens.member_id",
  "member_policy_consents.member_id",
  "member_profile_images.member_id",
  "member_ssafy_verifications.member_id",
  "notification_deliveries.member_id",
  "partner_favorites.member_id",
  "partner_review_reactions.member_id",
  "push_delivery_logs.member_id",
  "push_message_logs.target_member_id",
  "push_preferences.member_id",
  "push_subscriptions.member_id",
  "showcase_candidate_exclusions.member_id",
  "showcase_experiences.member_id",
  "showcase_feedback.member_id",
  "showcase_interests.member_id",
  "showcase_project_views.member_id",
  "showcase_projects.owner_member_id",
  "showcase_registrations.member_id",
  "showcase_winners.member_id",
] as const;

// Wallet rows are purged by a dedicated RPC that gates the anonymization.
const CLEARED_BY_WALLET_PURGE = [
  "member_wallet_pass_operations.member_id",
  "member_wallet_passes.member_id",
] as const;

const PROCESSING_SUBJECT = "관리자·작성자 등 처리 주체 감사 연결. 회원 행 자체가 익명화된다.";
const RETAINED: Record<string, string> = {
  "ad_coupon_issues.member_id": "쿠폰 발급 원장. 캠페인 정산 증빙이다.",
  "ad_coupon_redemptions.member_id": "쿠폰 사용 기록. 정산 증빙이다.",
  "partner_benefit_usages.member_id": "혜택 이용 원장. 1년 보존 purge가 정리한다.",
  "partner_reviews.member_id": "공개 리뷰 본문. 작성자는 탈퇴한 회원으로 표시된다.",
  "admin_profiles.member_id": "비활성화된 관리자 권한 이력.",
  "graduate_verification_requests.reviewer_admin_id": PROCESSING_SUBJECT,
  "manual_member_import_batches.created_by_admin_id": PROCESSING_SUBJECT,
  "mattermost_sender_credentials.created_by_admin_id": PROCESSING_SUBJECT,
  "member_email_login_transitions.initiated_by_admin_id": PROCESSING_SUBJECT,
  "member_profile_images.reviewer_admin_id": PROCESSING_SUBJECT,
  "member_signup_approval_requests.reviewed_by_admin_id": PROCESSING_SUBJECT,
  "notification_templates.updated_by": PROCESSING_SUBJECT,
  "notifications.created_by_member_id": PROCESSING_SUBJECT,
  "partner_billing_payments.confirmed_by_admin_id": PROCESSING_SUBJECT,
  "partner_company_plan_events.actor_admin_id": PROCESSING_SUBJECT,
  "partner_plan_upgrade_requests.reviewed_by_admin_id": PROCESSING_SUBJECT,
  "partner_reviews.deleted_by_member_id": PROCESSING_SUBJECT,
  "partner_tax_documents.issued_by_admin_id": PROCESSING_SUBJECT,
  "showcase_candidate_exclusions.excluded_by_admin_id": PROCESSING_SUBJECT,
  "showcase_candidate_exclusions.restored_by_admin_id": PROCESSING_SUBJECT,
  "showcase_draws.admin_id": PROCESSING_SUBJECT,
  "showcase_events.settled_by_admin_id": PROCESSING_SUBJECT,
  "showcase_feedback.hidden_by_admin_id": PROCESSING_SUBJECT,
  "showcase_projects.reviewed_by_admin_id": PROCESSING_SUBJECT,
  "showcase_winners.delivered_by_admin_id": PROCESSING_SUBJECT,
  "showcase_winners.voided_by_admin_id": PROCESSING_SUBJECT,
};

async function readMigrations() {
  const directory = new URL("supabase/migrations/", root);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map((name) => readFile(new URL(name, directory), "utf8")));
}

/** Replays the migrations and returns "table.column" pairs that reference members(id). */
function collectMemberForeignKeys(sources: string[]) {
  const pairs = new Set<string>();
  for (const source of sources) {
    const sql = source.replace(/--[^\n]*/gu, "");
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/giu)) {
      let depth = 1;
      let index = match.index + match[0].length;
      while (depth > 0 && index < sql.length) {
        if (sql[index] === "(") depth += 1;
        else if (sql[index] === ")") depth -= 1;
        index += 1;
      }
      for (const line of sql.slice(match.index + match[0].length, index - 1).split("\n")) {
        const column = new RegExp(String.raw`^\s*([a-z_][a-z0-9_]*)\s+uuid\b.*${MEMBER_REFERENCE}`, "iu").exec(line);
        if (column) pairs.add(`${match[1].toLowerCase()}.${column[1].toLowerCase()}`);
      }
    }
    for (const statement of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+([^;]*);/giu)) {
      const table = statement[1].toLowerCase();
      const added = new RegExp(String.raw`add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+uuid\b[^,]*?${MEMBER_REFERENCE}`, "giu");
      const constrained = new RegExp(String.raw`foreign\s+key\s*\(\s*([a-z_][a-z0-9_]*)\s*\)\s*${MEMBER_REFERENCE}`, "giu");
      for (const add of statement[2].matchAll(added)) pairs.add(`${table}.${add[1].toLowerCase()}`);
      for (const foreignKey of statement[2].matchAll(constrained)) pairs.add(`${table}.${foreignKey[1].toLowerCase()}`);
      for (const drop of statement[2].matchAll(/drop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/giu)) {
        pairs.delete(`${table}.${drop[1].toLowerCase()}`);
      }
    }
    for (const drop of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/giu)) {
      for (const pair of [...pairs]) {
        if (pair.startsWith(`${drop[1].toLowerCase()}.`)) pairs.delete(pair);
      }
    }
  }
  return pairs;
}

function latestAnonymizationBody(sources: string[]) {
  const signature = "create or replace function public.anonymize_deleted_member(p_member_id uuid)";
  const source = [...sources].reverse().find((sql) => sql.includes(signature));
  assert.ok(source, "anonymization function must exist");
  const start = source.lastIndexOf(signature);
  const end = source.indexOf("\n$$;", start);
  return source.slice(start, end);
}

test("members를 가리키는 모든 FK 컬럼은 익명화 처리 목록이나 보존 목록에 있다", async () => {
  const discovered = collectMemberForeignKeys(await readMigrations());
  const classified = new Set<string>([
    ...CLEARED_BY_ANONYMIZATION,
    ...CLEARED_BY_WALLET_PURGE,
    ...Object.keys(RETAINED),
  ]);
  assert.ok(discovered.size >= 50, "the migration replay finds the member FK columns");
  assert.deepEqual(
    [...discovered].filter((pair) => !classified.has(pair)).sort(),
    [],
    "classify every new member FK column",
  );
  assert.deepEqual(
    [...classified].filter((pair) => !discovered.has(pair)).sort(),
    [],
    "remove classifications for columns that no longer exist",
  );
  for (const reason of Object.values(RETAINED)) assert.ok(reason.trim().length > 0);
});

test("처리 목록의 컬럼은 최신 anonymize_deleted_member 본문이 직접 지우거나 분리한다", async () => {
  const body = latestAnonymizationBody(await readMigrations());
  for (const pair of CLEARED_BY_ANONYMIZATION) {
    const [table, column] = pair.split(".");
    assert.match(
      body,
      new RegExp(String.raw`public\.${table}\b[^;]*?\b${column} = (?:p_member_id|\$1)`, "u"),
      `${pair} must be cleared by anonymize_deleted_member`,
    );
  }
  assert.match(
    body,
    /if not public\.purge_deleted_member_wallet_data_for_anonymization\(p_member_id\) then/u,
  );
});

test("익명화는 증빙 행을 남기되 식별 정보만 지운다", async () => {
  const body = latestAnonymizationBody(await readMigrations());
  assert.match(body, /update public\.member_policy_consents\s+set ip_address = null,\s+user_agent = null/u);
  assert.match(body, /update public\.event_reward_winners\s+set display_name = '탈퇴한 회원',\s+mm_username = null,\s+campus = null/u);
  assert.match(body, /update public\.manual_member_import_rows\s+set member_id = null,\s+display_name = null,\s+mm_username = null,\s+email = null,\s+email_normalized = null/u);
  assert.match(body, /update public\.showcase_registrations\s+set member_id = null,\s+student_number = null/u);
  assert.match(body, /delete from public\.showcase_project_participants participant[\s\S]*?project\.owner_member_id = p_member_id\s+and participant\.is_owner;/u);
  assert.doesNotMatch(body, /delete from public\.partner_reviews\b/u);
  assert.doesNotMatch(body, /delete from public\.partner_benefit_usages\b/u);
});
