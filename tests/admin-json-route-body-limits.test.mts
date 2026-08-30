import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_BULK_JSON_BODY_BYTES,
  MAX_STANDARD_JSON_BODY_BYTES,
} from "../src/lib/request-body-limit.ts";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "../src/lib/route-json-body.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

const standardRoutePaths = [
  "src/app/api/admin/logs/export/route.ts",
  "src/app/api/admin/member-imports/[batchId]/rows/[rowNumber]/reissue-setup/route.ts",
  "src/app/api/admin/members/[id]/password-reset/route.ts",
  "src/app/api/admin/members/[id]/profile-photo/route.ts",
] as const;

function createStreamedRequest(maximumBytes: number) {
  const encoder = new TextEncoder();
  const serialized = JSON.stringify({ padding: "가".repeat(maximumBytes) });
  const bytes = encoder.encode(serialized);
  const midpoint = Math.floor(bytes.byteLength / 2);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, midpoint));
      controller.enqueue(bytes.slice(midpoint));
      controller.close();
    },
  });

  return new Request("https://ssartnership.example/api/admin/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

async function assertOversizedBodyIs413(maximumBytes: number) {
  const options = {
    maximumBytes,
    invalidMessage: "기존 형식 오류 안내",
  };

  for (const request of [
    new Request("https://ssartnership.example/api/admin/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(maximumBytes + 1),
      },
      body: "{}",
    }),
    createStreamedRequest(maximumBytes),
  ]) {
    await assert.rejects(
      readRouteJsonBodyWithinLimit(request, options),
      (error: unknown) =>
        error instanceof RouteJsonBodyError
        && error.code === "body_too_large"
        && error.status === 413
        && error.message === options.invalidMessage,
    );
  }
}

test("관리자 단일 JSON 작업은 인증 뒤 공용 4KiB reader와 기존 오류 응답을 사용한다", async () => {
  const sources = await Promise.all(standardRoutePaths.map(read));

  for (const source of sources) {
    const routeSource = source.slice(source.indexOf("export async function POST"));
    const parserIndex = routeSource.indexOf("await readRouteJsonBodyWithinLimit");
    const authIndex = Math.max(
      routeSource.indexOf("ensureAdminApiPermission"),
      routeSource.indexOf("getAdminApiPermissionSession"),
      routeSource.indexOf("getAdminSession"),
    );

    assert.match(source, /MAX_STANDARD_JSON_BODY_BYTES/);
    assert.match(source, /maximumBytes: MAX_STANDARD_JSON_BODY_BYTES/);
    assert.match(source, /error instanceof RouteJsonBodyError/);
    assert.match(source, /status: error\.status|error\.status\)/);
    assert.doesNotMatch(source, /request\.json\(/);
    assert.ok(authIndex >= 0 && parserIndex > authIndex);
  }

  assert.match(sources[0], /invalidMessage: '내보내기 요청 형식이 올바르지 않습니다\.'/);
  assert.match(sources[1], /invalidMessage: "새 초기 설정 링크 발급 확인이 필요합니다\."/);
  assert.match(sources[2], /invalidMessage: "재발급 방식을 확인해 주세요\."/);
  assert.match(sources[2], /response\(\{ ok: false, message: error\.message \}, error\.status\)/);
  assert.match(sources[3], /invalidMessage: "사진 업로드를 확인해 주세요\."/);
  assert.match(sources[3], /recordGraduateVerificationAttempt\(\{ \.\.\.rateLimitContext, success: false \}\)/);

  await assertOversizedBodyIs413(MAX_STANDARD_JSON_BODY_BYTES);
});

test("관리자 회원 일괄 가져오기는 JSON 분기에만 공용 128KiB 상한을 적용한다", async () => {
  const source = await read("src/app/api/admin/member-imports/route.ts");
  const routeSource = source.slice(source.indexOf("export async function POST"));
  const authIndex = routeSource.indexOf("requireImportAdmin(request)");
  const contentTypeIndex = routeSource.indexOf("contentType.includes(\"application/json\")");
  const parserIndex = routeSource.indexOf("await readRouteJsonBodyWithinLimit");

  assert.match(source, /MAX_BULK_JSON_BODY_BYTES/);
  assert.match(source, /maximumBytes: MAX_BULK_JSON_BODY_BYTES/);
  assert.match(source, /invalidMessage: "회원 행과 사진 목록을 확인해 주세요\."/);
  assert.match(source, /\{ ok: false, errors: \[error\.message\] \}/);
  assert.match(source, /\{ status: error\.status \}/);
  assert.doesNotMatch(source, /request\.json\(/);
  assert.ok(
    authIndex >= 0
    && contentTypeIndex > authIndex
    && parserIndex > contentTypeIndex,
  );

  await assertOversizedBodyIs413(MAX_BULK_JSON_BODY_BYTES);
});
