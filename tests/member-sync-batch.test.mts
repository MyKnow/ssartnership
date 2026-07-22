import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_MEMBER_SYNC_BATCH_SIZE,
  MAX_MEMBER_SYNC_BATCH_SIZE,
  parseMemberSyncBatchOptions,
} from "../src/lib/mm-member-sync/batch.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("회원 MM 백필은 기본 배치 크기와 빈 cursor로 시작한다", () => {
  assert.deepEqual(parseMemberSyncBatchOptions({}), {
    limit: DEFAULT_MEMBER_SYNC_BATCH_SIZE,
    cursor: null,
  });
});

test("회원 MM 백필은 허용된 배치 크기와 UUID cursor를 보존한다", () => {
  const cursor = "8f8e8f8e-8f8e-4f8e-8f8e-8f8e8f8e8f8e";

  assert.deepEqual(parseMemberSyncBatchOptions({
    batchSize: String(MAX_MEMBER_SYNC_BATCH_SIZE),
    cursor,
  }), {
    limit: MAX_MEMBER_SYNC_BATCH_SIZE,
    cursor,
  });
});

test("회원 MM 백필은 범위를 벗어난 배치 크기와 잘못된 cursor를 거부한다", () => {
  assert.equal(parseMemberSyncBatchOptions({ batchSize: "0" }), null);
  assert.equal(parseMemberSyncBatchOptions({ batchSize: String(MAX_MEMBER_SYNC_BATCH_SIZE + 1) }), null);
  assert.equal(parseMemberSyncBatchOptions({ batchSize: "1.5" }), null);
  assert.equal(parseMemberSyncBatchOptions({ batchSize: "1e2" }), null);
  assert.equal(parseMemberSyncBatchOptions({ cursor: "not-a-uuid" }), null);
});

test("관리자 백필 action과 화면은 이어하기 cursor 계약을 사용한다", async () => {
  const [actions, page, sync] = await Promise.all([
    read("src/app/admin/(protected)/_actions/member-actions.ts"),
    read("src/app/admin/(protected)/members/page.tsx"),
    read("src/lib/mm-member-sync/sync.ts"),
  ]);

  assert.match(actions, /parseMemberSyncBatchOptions/);
  assert.match(actions, /nextCursor/);
  assert.match(actions, /hasMore/);
  assert.match(page, /name="batchSize"/);
  assert.match(page, /name="cursor"/);
  assert.match(page, /nextCursor/);
  assert.match(page, /hasMore/);
  assert.match(sync, /order\("id", \{ ascending: true \}\)/);
  assert.match(sync, /limit\(options\.limit \+ 1\)/);
  assert.match(sync, /query = query\.gt\("id", options\.cursor\)/);
});
