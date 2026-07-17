import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("회원 상세 단건 동기화는 기존 서비스·권한·감사 로그를 재사용한다", async () => {
  const [memberActions, publicActions, detailPage, detailView, accountManager, profileSync, statusMessages] =
    await Promise.all([
      read("src/app/admin/(protected)/_actions/member-actions.ts"),
      read("src/app/admin/(protected)/actions.ts"),
      read("src/app/admin/(protected)/members/[memberId]/page.tsx"),
      read("src/components/admin/AdminMemberDetailView.tsx"),
      read("src/components/admin/member-detail/AdminMemberAccountManager.tsx"),
      read("src/lib/member-mattermost-profile-sync.ts"),
      read("src/components/admin/member-detail/AdminMemberDetailStatusMessages.tsx"),
    ]);

  assert.match(memberActions, /syncMemberById/);
  assert.match(memberActions, /export async function syncMemberProfileAction\(formData: FormData\)/);
  assert.match(memberActions, /requireAdminPermission\("members", "update"/);
  assert.match(memberActions, /isUuid\(memberId\)/);
  assert.match(memberActions, /buildMemberSyncLogProperties/);
  assert.match(memberActions, /lifecycleStatus: result\.lifecycleStatus/);
  assert.match(memberActions, /detailCode: result\.detailCode/);
  assert.match(memberActions, /providerRequestId: result\.providerRequestId/);
  assert.match(memberActions, /logAdminAction\("member_sync"/);
  assert.match(memberActions, /source: "member_detail"/);
  assert.match(memberActions, /logAdminAction\("member_email_login_transition"/);
  assert.match(memberActions, /source: "member_detail"/);
  assert.match(memberActions, /revalidatePath\(detailPath\)/);
  assert.match(memberActions, /resolveMemberProfileSyncStatus/);
  assert.match(memberActions, /memberSync=mattermostUnavailable/);

  assert.match(publicActions, /syncMemberProfileAction/);
  assert.match(publicActions, /export async function syncMemberProfile\(formData: FormData\)/);
  assert.match(detailPage, /syncMemberProfile/);
  assert.match(detailPage, /memberSync/);
  assert.match(detailPage, /AdminMemberDetailStatusMessages/);
  assert.match(statusMessages, /MM 프로필을 동기화했습니다/);
  assert.match(statusMessages, /MM 프로필 사진을 처리하지 못했습니다/);
  assert.match(statusMessages, /MM 이용 상태를 종료 처리했습니다/);
  assert.match(detailView, /syncMemberProfileAction/);
  assert.match(accountManager, /MM 프로필 동기화/);
  assert.match(accountManager, /!member\.mattermostLoginDisabledAt/);
  assert.match(profileSync, /\.is\("mattermost_login_disabled_at", null\)/);
  assert.match(profileSync, /withActiveMattermostSenderForSubject/);
  assert.match(profileSync, /session\.getUserById\(directory\.mm_user_id\)/);
  assert.match(profileSync, /toMattermostLifecycleResult/);
  assert.match(profileSync, /resolveMattermostLifecycle/);
  assert.match(profileSync, /fetchMemberSnapshotForUser/);
  assert.doesNotMatch(profileSync, /fetchMemberLifecycleByUserId/);
  assert.doesNotMatch(profileSync, /fetchMemberSnapshotByUsername/);
  assert.match(profileSync, /imageSkipped/);
});

test("백필도 사진 미처리를 변경 없음으로 집계하지 않는다", async () => {
  const [memberActions, memberSync, memberPage] = await Promise.all([
    read("src/app/admin/(protected)/_actions/member-actions.ts"),
    read("src/lib/mm-member-sync/sync.ts"),
    read("src/app/admin/(protected)/members/page.tsx"),
  ]);

  assert.match(memberSync, /const photoSkipped: MemberSyncResult\[\] = \[\]/);
  assert.match(memberSync, /if \(result\.imageSkipped\) \{\s*photoSkipped\.push\(result\);/);
  assert.match(memberSync, /if \(!result\.updated && !result\.imageSkipped\) \{\s*skipped \+= 1;/);
  assert.match(memberActions, /photoSkipped: result\.photoSkipped\.length/);
  assert.match(memberActions, /result\.photoSkipped\.length > 0/);
  assert.match(memberActions, /photoSkipped=\$\{summary\.photoSkipped\}/);
  assert.match(memberActions, /logAdminAuditBatch/);
  assert.match(memberSync, /auditResults/);
  assert.match(memberPage, /사진 미처리 \$\{params\.photoSkipped\}명/);
});
