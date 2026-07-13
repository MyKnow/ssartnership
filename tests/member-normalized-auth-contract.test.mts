import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("로그인과 비밀번호 재설정은 정규화된 회원·MM 디렉터리 관계만 사용한다", () => {
  const memberAuthentication = readRepoFile("src/lib/member-authentication.ts");
  const resetIdentity = readRepoFile(
    "src/app/api/mm/_shared/reset-password-identity.ts",
  );
  const ssafyResetRoute = readRepoFile(
    "src/app/api/ssafy/reset-password/route.ts",
  );
  const resetComplete = readRepoFile(
    "src/app/api/mm/_shared/reset-password-complete.ts",
  );

  assert.match(memberAuthentication, /mattermost_account_id/);
  assert.doesNotMatch(
    memberAuthentication,
    /findActiveMemberByLegacyMattermostUserId|member_auth_identities|\.eq\("mm_user_id"/,
  );

  assert.match(resetIdentity, /\.eq\("mattermost_account_id", directoryEntry\.id\)/);
  assert.doesNotMatch(resetIdentity, /@\/lib\/mm-member-sync|\.eq\("mm_user_id"/);

  assert.match(ssafyResetRoute, /memberResult\.member\.mattermost_account_id/);
  assert.match(ssafyResetRoute, /\.from\("mm_user_directory"\)/);
  assert.match(
    ssafyResetRoute,
    /memberUpdatedAt: memberResult\.member\.updated_at/,
  );
  assert.doesNotMatch(
    ssafyResetRoute,
    /memberResult\.member\.mm_user_id|memberResult\.member\.mm_username/,
  );

  assert.match(
    resetComplete,
    /\.from\("mm_user_directory"\)[\s\S]{0,400}\.eq\("mm_user_id", tokenPayload\.mmUserId\)/,
  );
  assert.match(
    resetComplete,
    /\.eq\("mattermost_account_id", directoryEntry\.id\)/,
  );
  assert.doesNotMatch(
    resetComplete,
    /\.from\("members"\)[\s\S]{0,500}\.eq\("mm_user_id"/,
  );
});
