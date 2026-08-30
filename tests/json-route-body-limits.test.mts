import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JsonRequestBodyError,
  readJsonRequestBodyWithinLimit,
} from "../src/lib/request-body-limit.ts";
import {
  getSafeNotificationRouteError,
  shouldLogNotificationRouteError,
} from "../src/lib/notifications/safe-error.ts";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "../src/lib/route-json-body.ts";

const root = new URL("..", import.meta.url);

function readSource(path: string) {
  return readFile(new URL(path, root), "utf8");
}

function createStreamedRequest(byteLength: number) {
  const encoder = new TextEncoder();
  const serialized = JSON.stringify({ padding: "x".repeat(byteLength) });
  const midpoint = Math.floor(serialized.length / 2);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(serialized.slice(0, midpoint)));
      controller.enqueue(encoder.encode(serialized.slice(midpoint)));
      controller.close();
    },
  });

  return new Request("https://ssartnership.example/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

async function assertBodyTooLarge(request: Request, maximumBytes: number) {
  await assert.rejects(
    readJsonRequestBodyWithinLimit(request, maximumBytes),
    (error: unknown) =>
      error instanceof JsonRequestBodyError &&
      error.code === "body_too_large",
  );
}

test("공개 로그인은 선언 길이와 streamed 본문 초과를 모두 413 계약으로 거부한다", async () => {
  const maximumBytes = 8 * 1024;
  const source = await readSource("src/app/api/auth/login/route.ts");
  const guardIndex = source.indexOf("if (!isTrustedSameOriginRequest");
  const parserIndex = source.indexOf("await readJsonRequestBodyWithinLimit");

  assert.match(source, /MAX_MEMBER_LOGIN_JSON_BODY_BYTES = 8 \* 1024/);
  assert.match(source, /error instanceof JsonRequestBodyError/);
  assert.match(source, /error\.code === "body_too_large"/);
  assert.match(source, /\{ error: "login_failed" \}, \{ status: 413 \}/);
  assert.ok(guardIndex >= 0 && parserIndex > guardIndex);

  await assertBodyTooLarge(
    new Request("https://ssartnership.example/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(maximumBytes + 1),
      },
      body: "{}",
    }),
    maximumBytes,
  );
  await assertBodyTooLarge(createStreamedRequest(maximumBytes), maximumBytes);
});

test("관리자 알림 설정은 인증 뒤 본문을 읽고 두 종류의 초과 요청을 413으로 거부한다", async () => {
  const maximumBytes = 4 * 1024;
  const source = await readSource(
    "src/app/api/admin/notifications/preferences/route.ts",
  );
  const postSource = source.slice(source.indexOf("export async function POST"));
  const guardIndex = postSource.indexOf("if (");
  const authIndex = postSource.indexOf("const auth =");
  const parserIndex = postSource.indexOf("await readJsonRequestBodyWithinLimit");

  assert.match(
    source,
    /MAX_STANDARD_JSON_BODY_BYTES/,
  );
  assert.match(source, /error\.code === "body_too_large"/);
  assert.match(source, /\{ message: "알림 설정 요청이 너무 큽니다\." \}/);
  assert.match(source, /\{ status: 413 \}/);
  assert.ok(
    guardIndex >= 0 && authIndex > guardIndex && parserIndex > authIndex,
  );

  await assertBodyTooLarge(
    new Request(
      "https://ssartnership.example/api/admin/notifications/preferences",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(maximumBytes + 1),
        },
        body: "{}",
      },
    ),
    maximumBytes,
  );
  await assertBodyTooLarge(createStreamedRequest(maximumBytes), maximumBytes);
});

test("수료생 업로드 서명과 관리자 push 구독도 bounded JSON reader를 사용한다", async () => {
  const [graduateSource, adminPushSource] = await Promise.all([
    readSource("src/app/api/graduate-verification/uploads/sign/route.ts"),
    readSource("src/app/api/admin/push/subscribe/route.ts"),
  ]);

  assert.match(
    graduateSource,
    /MAX_STANDARD_JSON_BODY_BYTES/,
  );
  assert.match(graduateSource, /await readJsonRequestBodyWithinLimit/);
  assert.match(graduateSource, /error\.code === "body_too_large"/);
  assert.match(graduateSource, /\? 413\s*: 400/);
  assert.doesNotMatch(graduateSource, /request\.json\(/);

  assert.match(
    adminPushSource,
    /MAX_PUSH_SUBSCRIPTION_JSON_BODY_BYTES/,
  );
  assert.match(adminPushSource, /await readJsonRequestBodyWithinLimit/);
  assert.match(adminPushSource, /error\.code === "body_too_large"/);
  assert.match(adminPushSource, /\{ status: 413 \}/);
  assert.doesNotMatch(adminPushSource, /request\.json\(/);
});

test("route JSON helper는 malformed와 oversized 본문을 안전한 상태로 구분한다", async () => {
  const options = {
    maximumBytes: 32,
    invalidMessage: "본문 형식을 확인해 주세요.",
    tooLargeMessage: "본문이 너무 큽니다.",
  };

  await assert.rejects(
    readRouteJsonBodyWithinLimit(
      new Request("https://ssartnership.example/api/test", {
        method: "POST",
        headers: { "content-length": "33" },
        body: "{}",
      }),
      options,
    ),
    (error: unknown) => {
      assert.ok(error instanceof RouteJsonBodyError);
      assert.equal(error.code, "body_too_large");
      assert.equal(error.status, 413);
      assert.equal(error.message, "본문이 너무 큽니다.");
      assert.deepEqual(getSafeNotificationRouteError(error, "fallback"), {
        message: "본문이 너무 큽니다.",
        status: 413,
      });
      assert.equal(shouldLogNotificationRouteError(error), false);
      assert.equal(
        shouldLogNotificationRouteError(new Error("storage unavailable")),
        true,
      );
      return true;
    },
  );

  await assert.rejects(
    readRouteJsonBodyWithinLimit(
      new Request("https://ssartnership.example/api/test", {
        method: "POST",
        body: "not-json",
      }),
      options,
    ),
    (error: unknown) =>
      error instanceof RouteJsonBodyError &&
      error.code === "invalid_json" &&
      error.status === 400 &&
      error.message === "본문 형식을 확인해 주세요.",
  );
});

test("회원·파트너·관리자 알림 JSON 경로는 공용 bounded reader를 사용한다", async () => {
  const routePaths = [
    "src/app/api/admin/push/unsubscribe/route.ts",
    "src/app/api/notifications/preferences/route.ts",
    "src/app/api/partner/notifications/preferences/route.ts",
    "src/app/api/partner/push/subscribe/route.ts",
    "src/app/api/partner/push/unsubscribe/route.ts",
    "src/app/api/push/subscribe/route.ts",
    "src/app/api/push/unsubscribe/route.ts",
  ];
  const sources = await Promise.all(routePaths.map(readSource));

  for (const source of sources) {
    assert.match(source, /readRouteJsonBodyWithinLimit/);
    assert.doesNotMatch(source, /request\.json\(/);
  }

  const safeErrorSource = await readSource(
    "src/lib/notifications/safe-error.ts",
  );
  assert.match(safeErrorSource, /error instanceof RouteJsonBodyError/);
  assert.match(safeErrorSource, /status: error\.status/);
  assert.match(safeErrorSource, /shouldLogNotificationRouteError/);
});
