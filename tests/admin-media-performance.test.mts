import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("회원 목록 아바타 조회는 읽기 요청에서 Mattermost 동기화를 실행하지 않는다", async () => {
  const source = await readFile(
    new URL(
      "../src/app/api/admin/members/[id]/avatar/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /syncMemberMattermostProfile/);
  assert.match(source, /\"cache-control\": \"private, no-store\"/);
  assert.match(source, /getActiveMemberProfileImage\(id\)/);
});

test("파트너 미디어 편집 이미지는 초기 문서 로드를 막지 않는다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/admin/partner-media-editor/MediaField.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal((source.match(/loading=\"lazy\"/g) ?? []).length, 2);
  assert.equal((source.match(/decoding=\"async\"/g) ?? []).length, 2);
});
