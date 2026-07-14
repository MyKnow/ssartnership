import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("관리자 대량 초대는 signed upload 뒤 행별 생성 API로 분리한다", async () => {
  const [preflight, commit, service] = await Promise.all([
    read("src/app/api/admin/member-imports/route.ts"),
    read("src/app/api/admin/member-imports/[batchId]/commit/route.ts"),
    read("src/lib/member-manual-import/service.server.ts"),
  ]);
  assert.match(preflight, /canAdmin\(session\.account\.permissions, "members", "create"\)/);
  assert.match(preflight, /prepareManualMemberImport/);
  assert.match(commit, /commitManualMemberImport/);
  assert.match(service, /createSignedUploadUrl/);
  assert.match(service, /status: "failed"/);
  assert.match(service, /deleteCreatedMember/);
  assert.match(service, /source: "manual_admin"/);
});

test("수동 초기 설정과 이메일 재설정은 토큰 해시만 서버에 전달한다", async () => {
  const [complete, reset, service] = await Promise.all([
    read("src/app/api/member-password-action/complete/route.ts"),
    read("src/app/api/member-password-action/reset/route.ts"),
    read("src/lib/member-manual-import/service.server.ts"),
  ]);
  assert.match(complete, /hashOpaqueToken\(token\)/);
  assert.match(complete, /completeManualMemberPasswordAction/);
  assert.doesNotMatch(complete, /properties:\s*\{[^}]*token/i);
  assert.match(reset, /hashMemberEmailIdentifier/);
  assert.match(reset, /issueManualMemberPasswordReset/);
  assert.match(service, /deliveryChannel: "email"/);
  assert.match(service, /deliveryChannel: "mattermost"/);
});
