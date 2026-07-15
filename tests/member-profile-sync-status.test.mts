import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("사진 동기화가 건너뛰어진 경우를 변경 없음으로 표시하지 않는다", async () => {
  const helper = await read("src/lib/member-profile-sync-status.ts");

  assert.match(helper, /imageSkipped/);
  assert.match(helper, /"profilePhotoSkipped"/);
  assert.match(helper, /"unchanged"/);
});

test("다른 프로필 항목이 반영됐어도 사진 실패 상태를 함께 보존한다", async () => {
  const helper = await read("src/lib/member-profile-sync-status.ts");

  assert.match(helper, /"updatedWithProfilePhotoSkipped"/);
  assert.match(helper, /input\.updated/);
});

test("사진 처리가 정상인 기존 동기화 상태는 유지한다", async () => {
  const helper = await read("src/lib/member-profile-sync-status.ts");

  assert.match(helper, /return input\.updated \? "updated" : "unchanged"/);
});
