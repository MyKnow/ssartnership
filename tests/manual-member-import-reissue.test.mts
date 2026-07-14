import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("전송 결과 미확인 행은 관리자 확인 뒤에만 새 초기 설정 링크를 발급한다", async () => {
  const [service, route, panel, catalog, logLabels, reissueMigration, completionMigration] = await Promise.all([
    read("src/lib/member-manual-import/service.server.ts"),
    read("src/app/api/admin/member-imports/[batchId]/rows/[rowNumber]/reissue-setup/route.ts"),
    read("src/components/admin/AdminMemberManualAddPanel.tsx"),
    read("src/lib/event-catalog.ts"),
    read("src/components/admin/logs/utils.ts"),
    read("supabase/migrations/20260715004318_add_manual_member_reissue_setup_guard.sql"),
    read("supabase/migrations/20260715004800_align_manual_setup_token_lock_order.sql"),
  ]);

  assert.match(service, /export async function reissueManualMemberImportSetup/);
  assert.match(service, /error_code: "delivery_outcome_unknown"/);
  assert.match(service, /purpose: "manual_initial_setup"/);
  assert.match(service, /async function resolveManualMemberImportReissueMattermostRecipient/);
  assert.match(service, /async function resolveManualMemberImportReissueEmailRecipient/);
  assert.match(service, /async function resolveManualMemberImportReissueMember/);
  assert.match(service, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(service, /select\("id,display_name,mattermost_account_id,email_normalized,must_change_password"\)/);
  assert.match(service, /!member\.must_change_password/);
  assert.match(service, /async function createManualInitialSetupReissueAction/);
  assert.match(service, /rpc\(\s*"reissue_manual_member_initial_setup"/);
  assert.match(service, /const setupToken = await createManualInitialSetupReissueAction/);
  assert.match(service, /member\.email_normalized !== input\.importEmailNormalized/);
  assert.match(service, /recipient: \{ mattermostUserId: mattermostRecipient\.mattermostUserId \}/);
  assert.match(service, /email: emailRecipient\.email/);
  assert.doesNotMatch(service, /recipient: \{ mattermostUserId: verified\?\.mattermostUserId \}/);
  assert.doesNotMatch(service, /email: row\.email_normalized as string/);
  assert.match(service, /async function reclaimExpiredManualMemberImportReissueLease/);
  assert.match(service, /\.lt\("updated_at", processingLeaseExpiredAt\)/);
  assert.match(service, /manual-member-import-reissue:/);
  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /canAdmin\(session\.account\.permissions, "members", "update"\)/);
  assert.match(route, /body\?\.confirmed !== true/);
  assert.match(route, /reissueManualMemberImportSetup/);
  assert.match(route, /logAdminAudit/);
  assert.match(panel, /확인 후 새 링크 발급/);
  assert.match(panel, /기존 미사용 링크는 무효화됩니다/);
  assert.match(panel, /reissue-setup/);
  assert.match(catalog, /member_manual_setup_link_reissue/);
  assert.match(logLabels, /member_manual_setup_link_reissue/);
  assert.match(reissueMigration, /create or replace function public\.reissue_manual_member_initial_setup/);
  assert.match(reissueMigration, /must_change_password = true/);
  assert.match(reissueMigration, /for update;/);
  assert.match(reissueMigration, /update public\.member_password_action_tokens/);
  assert.match(reissueMigration, /grant execute on function public\.reissue_manual_member_initial_setup/);
  assert.match(completionMigration, /create or replace function public\.complete_manual_member_password_action/);
  assert.match(
    completionMigration,
    /select member_id into candidate_member_id[\s\S]*?select \* into member_row[\s\S]*?for update;[\s\S]*?select \* into token_row[\s\S]*?for update;/,
  );
});
