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

test("회원 관리 화면은 수동 초대와 별도로 직접 계정 생성 패널을 유지한다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/members/page.tsx", import.meta.url),
    "utf8",
  );

  const manualAddIndex = source.indexOf('title="수동 추가"');
  const directCreateIndex = source.indexOf('title="직접 계정 생성"');
  const operationsNoteIndex = source.indexOf('title="운영 메모"');

  assert.match(source, /AdminMemberDirectCreatePanel/);
  assert.match(source, /createDirectMember/);
  assert.ok(directCreateIndex > manualAddIndex);
  assert.ok(operationsNoteIndex > directCreateIndex);
});
