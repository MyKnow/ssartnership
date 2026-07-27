import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createServerTimingRecorder,
  formatServerTimingHeader,
  withServerTiming,
} from "../src/lib/server-timing.ts";

test("Server-Timing은 허용된 phase와 제한된 시간만 직렬화한다", () => {
  assert.equal(
    formatServerTimingHeader([
      { name: "auth", durationMs: 12.4 },
      { name: "query", durationMs: 185.6 },
      { name: "raw/path", durationMs: 42 },
      { name: "db", durationMs: Number.POSITIVE_INFINITY },
    ]),
    "auth;dur=12, query;dur=186, db;dur=0",
  );
});

test("Server-Timing 래퍼는 성공·복구 응답 모두에 total 시간을 붙인다", async () => {
  const response = await withServerTiming(async (timing) => {
    await timing.measure("query", async () => undefined);
    timing.record("render", 15.4);
    return new Response(JSON.stringify({ ok: true }));
  });

  const header = response.headers.get("Server-Timing") ?? "";
  assert.match(header, /query;dur=\d+/);
  assert.match(header, /render;dur=15/);
  assert.match(header, /total;dur=\d+/);
  assert.doesNotMatch(header, /raw|path|message|secret|\//i);
});

test("Server-Timing recorder는 민감한 동적 값을 헤더로 내보내지 않는다", async () => {
  const timing = createServerTimingRecorder();
  await timing.measure("db", () => undefined);
  timing.record("member_id", 12);
  timing.record("partner-lookup", 15);

  const header = timing.headerValue();
  assert.match(header, /db;dur=\d+/);
  assert.match(header, /member_id;dur=12/);
  assert.match(header, /partner-lookup;dur=15/);
  assert.doesNotMatch(header, /uuid|error|raw|\/|\?/i);
});

test("핵심 관리자 읽기 API는 인증·세션·조회 구간을 Server-Timing으로 계측한다", async () => {
  const routeSources = await Promise.all(
    [
      "../src/app/api/admin/logs/route.ts",
      "../src/app/api/admin/logs/[group]/[id]/route.ts",
      "../src/app/api/admin/reviews/[reviewId]/route.ts",
      "../src/app/api/admin/notification-templates/detail/route.ts",
      "../src/app/api/admin/notification-templates/test-recipients/route.ts",
      "../src/app/api/admin/notifications/route.ts",
      "../src/app/api/admin/notifications/preferences/route.ts",
      "../src/app/api/admin/notifications/[id]/route.ts",
      "../src/app/api/admin/push/recipients/route.ts",
      "../src/app/api/push/admin/preview/route.ts",
      "../src/app/api/push/admin/broadcast/route.ts",
      "../src/app/api/push/admin/logs/[id]/route.ts",
      "../src/app/api/admin/logs/export/route.ts",
      "../src/app/api/admin/push/subscribe/route.ts",
      "../src/app/api/admin/push/unsubscribe/route.ts",
      "../src/app/api/admin/member-imports/route.ts",
      "../src/app/api/admin/member-imports/[batchId]/commit/route.ts",
      "../src/app/api/admin/member-imports/[batchId]/rows/[rowNumber]/reissue-setup/route.ts",
      "../src/app/api/admin/member-imports/rows/route.ts",
      "../src/app/api/admin/ad-coupons/[couponId]/codes/route.ts",
      "../src/app/api/admin/graduate-verifications/[requestId]/certificate/route.ts",
      "../src/app/api/admin/graduate-verifications/images/[imageId]/route.ts",
      "../src/app/api/admin/member-signup-requests/[requestId]/profile-image/route.ts",
      "../src/app/api/admin/members/[id]/profile-photo/route.ts",
      "../src/app/api/admin/profile-photos/current/[memberId]/route.ts",
      "../src/app/api/admin/profile-photos/images/[imageId]/route.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of routeSources) {
    assert.match(source, /withServerTiming/);
    assert.match(source, /timing\.measure\(\s*["']auth/);
    assert.match(source, /timing\.measure\(\s*["']query/);
  }
});

test("관리자 미디어·가져오기 API는 인증 이후 query 또는 Storage 구간을 계측한다", async () => {
  const routeSources = await Promise.all(
    [
      "../src/app/api/admin/member-imports/route.ts",
      "../src/app/api/admin/member-imports/[batchId]/commit/route.ts",
      "../src/app/api/admin/member-imports/[batchId]/rows/[rowNumber]/reissue-setup/route.ts",
      "../src/app/api/admin/member-imports/rows/route.ts",
      "../src/app/api/admin/member-imports/template/route.ts",
      "../src/app/api/admin/ad-coupons/[couponId]/codes/route.ts",
      "../src/app/api/admin/graduate-verifications/[requestId]/certificate/route.ts",
      "../src/app/api/admin/graduate-verifications/images/[imageId]/route.ts",
      "../src/app/api/admin/member-signup-requests/[requestId]/profile-image/route.ts",
      "../src/app/api/admin/members/[id]/profile-photo/route.ts",
      "../src/app/api/admin/profile-photos/current/[memberId]/route.ts",
      "../src/app/api/admin/profile-photos/images/[imageId]/route.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of routeSources) {
    assert.match(source, /withServerTiming/);
    assert.match(source, /timing\.measure\(\s*["']auth/);
    assert.match(source, /timing\.measure\(\s*["'](query|lookup|storage|mutation|render)/);
  }
});

test("반복 조회 가능 관리자 목록 API는 private 조건부 응답을 사용한다", async () => {
  const routeSources = await Promise.all(
    [
      "../src/app/api/admin/logs/route.ts",
      "../src/app/api/admin/notifications/route.ts",
      "../src/app/api/admin/push/recipients/route.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of routeSources) {
    assert.match(source, /conditionalJsonResponse/);
  }
});

test("지연 아바타 API는 인증·조회·Storage 구간을 계측한다", async () => {
  const source = await readFile(
    new URL("../src/app/api/admin/members/[id]/avatar/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /withServerTiming/);
  assert.match(source, /timing\.measure\("auth"/);
  assert.match(source, /timing\.measure\("query"/);
  assert.match(source, /timing\.measure\("storage"/);
});
