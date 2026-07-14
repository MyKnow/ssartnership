import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("회원 관리 화면은 수동 추가와 운영 메모를 회원 목록보다 먼저 노출한다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/members/page.tsx", import.meta.url),
    "utf8",
  );
  const manualAddIndex = source.indexOf('title="수동 추가"');
  const operationsNoteIndex = source.indexOf('title="운영 메모"');
  const memberListIndex = source.indexOf('title="회원 목록"');

  assert.ok(manualAddIndex >= 0);
  assert.ok(operationsNoteIndex > manualAddIndex);
  assert.ok(memberListIndex > operationsNoteIndex);
  assert.doesNotMatch(source, /2xl:sticky/);
});

test("회원 관리 화면은 직접 계정 생성 패널을 노출하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/members/page.tsx", import.meta.url),
    "utf8",
  );

  const manualAddIndex = source.indexOf('title="수동 추가"');
  const operationsNoteIndex = source.indexOf('title="운영 메모"');

  assert.doesNotMatch(source, /AdminMemberDirectCreatePanel/);
  assert.doesNotMatch(source, /createDirectMember/);
  assert.equal(source.includes('title="직접 계정 생성"'), false);
  assert.ok(operationsNoteIndex > manualAddIndex);
});

test("직접 계정 생성 서버 경계는 운영 화면 제거와 별도로 유지한다", async () => {
  const [actionsSource, memberActionsSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/_actions/member-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(actionsSource, /export async function createDirectMember/);
  assert.match(actionsSource, /return createDirectMemberAction\(prevState, formData\)/);
  assert.match(memberActionsSource, /requireAdminPermission\("members", "create"/);
  assert.match(memberActionsSource, /validateDirectMemberCreateInput/);
  assert.match(memberActionsSource, /provisionDirectMember/);
  assert.match(memberActionsSource, /logAdminAudit/);
});
