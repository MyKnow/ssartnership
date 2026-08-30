import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JsonRequestBodyError,
  MAX_EXTENDED_JSON_BODY_BYTES,
  MAX_STANDARD_JSON_BODY_BYTES,
  readJsonRequestBodyWithinLimit,
} from "../src/lib/request-body-limit.ts";

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

test("쿠폰·MM·파트너·Wallet JSON 경로는 공용 bounded reader와 shared cap을 사용한다", async () => {
  const standardRoutePaths = [
    "src/app/api/coupon-issues/[issueId]/redeem/route.ts",
    "src/app/api/coupons/[couponId]/redeem/route.ts",
    "src/app/api/mm/code/issue/route.ts",
    "src/app/api/mm/code/verify/route.ts",
    "src/app/api/partner/reviews/[reviewId]/route.ts",
    "src/app/api/partners/[id]/benefit-use/route.ts",
    "src/app/api/partners/[id]/favorite/route.ts",
    "src/app/api/partners/[id]/reviews/[reviewId]/reaction/route.ts",
    "src/app/api/wallet/apple/pass/route.ts",
  ];
  const standardSources = await Promise.all(standardRoutePaths.map(readSource));

  for (const source of standardSources) {
    assert.match(source, /readRouteJsonBodyWithinLimit/);
    assert.match(source, /MAX_STANDARD_JSON_BODY_BYTES/);
    assert.match(source, /RouteJsonBodyError/);
    assert.doesNotMatch(source, /request\.json\(/);
  }

  const signupSource = await readSource("src/app/api/mm/signup/route.ts");
  assert.match(signupSource, /readRouteJsonBodyWithinLimit/);
  assert.match(signupSource, /MAX_EXTENDED_JSON_BODY_BYTES/);
  assert.match(signupSource, /error\.code === "body_too_large"/);
  assert.doesNotMatch(signupSource, /request\.json\(/);
});

test("공용 reader는 선언 길이와 실제 stream 초과를 body_too_large로 구분한다", async () => {
  await assert.rejects(
    readJsonRequestBodyWithinLimit(
      new Request("https://ssartnership.example/api/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(MAX_STANDARD_JSON_BODY_BYTES + 1),
        },
        body: "{}",
      }),
      MAX_STANDARD_JSON_BODY_BYTES,
    ),
    (error: unknown) =>
      error instanceof JsonRequestBodyError &&
      error.code === "body_too_large",
  );

  await assert.rejects(
    readJsonRequestBodyWithinLimit(
      createStreamedRequest(MAX_EXTENDED_JSON_BODY_BYTES),
      MAX_EXTENDED_JSON_BODY_BYTES,
    ),
    (error: unknown) =>
      error instanceof JsonRequestBodyError &&
      error.code === "body_too_large",
  );
});

test("본문 제한은 기존 same-origin·인증·quota 순서를 보존한다", async () => {
  const routeChecks = [
    {
      path: "src/app/api/coupon-issues/[issueId]/redeem/route.ts",
      before: ["isTrustedSameOriginRequest", "getSignedUserSession", "safeDecodeSegment"],
    },
    {
      path: "src/app/api/coupons/[couponId]/redeem/route.ts",
      before: ["isTrustedSameOriginRequest", "getSignedUserSession", "safeDecodeSegment"],
    },
    {
      path: "src/app/api/mm/signup/route.ts",
      before: ["isTrustedSameOriginRequest", "getMattermostCodeSession"],
    },
    {
      path: "src/app/api/partner/reviews/[reviewId]/route.ts",
      before: ["isTrustedSameOriginRequest", "getPartnerSession"],
    },
    {
      path: "src/app/api/partners/[id]/benefit-use/route.ts",
      before: ["isTrustedSameOriginRequest", "getSignedUserSession", "safeDecodeSegment"],
    },
    {
      path: "src/app/api/partners/[id]/favorite/route.ts",
      before: ["isTrustedSameOriginRequest", "getSignedUserSession", "partnerExists"],
    },
    {
      path: "src/app/api/partners/[id]/reviews/[reviewId]/reaction/route.ts",
      before: [
        "isTrustedSameOriginRequest",
        "getReviewMemberSession",
        "getPartnerReviewModerationRecord",
      ],
    },
  ];

  for (const check of routeChecks) {
    const source = await readSource(check.path);
    const handler = source.slice(source.indexOf("export async function"));
    const readerIndex = handler.indexOf("readRouteJsonBodyWithinLimit");
    assert.ok(readerIndex >= 0, `${check.path} must parse through the bounded reader`);
    for (const marker of check.before) {
      const markerIndex = handler.indexOf(marker);
      assert.ok(
        markerIndex >= 0 && markerIndex < readerIndex,
        `${check.path}: ${marker} must run before body parsing`,
      );
    }
  }

  const walletSource = await readSource("src/app/api/wallet/apple/pass/route.ts");
  for (const method of ["POST", "DELETE"]) {
    const start = walletSource.indexOf(`export async function ${method}`);
    const handler = walletSource.slice(start);
    assert.ok(handler.indexOf("isTrustedSameOriginRequest") < handler.indexOf("requireSignedUserId"));
    assert.ok(handler.indexOf("requireSignedUserId") < handler.indexOf("consumeWalletPassQuota"));
    assert.ok(handler.indexOf("consumeWalletPassQuota") < handler.indexOf("parseJsonBody"));
  }
});

test("malformed JSON 응답 계약과 oversized 413 envelope를 유지한다", async () => {
  const [issue, verify, signup, moderation, reaction, wallet] = await Promise.all([
    readSource("src/app/api/mm/code/issue/route.ts"),
    readSource("src/app/api/mm/code/verify/route.ts"),
    readSource("src/app/api/mm/signup/route.ts"),
    readSource("src/app/api/partner/reviews/[reviewId]/route.ts"),
    readSource("src/app/api/partners/[id]/reviews/[reviewId]/reaction/route.ts"),
    readSource("src/app/api/wallet/apple/pass/route.ts"),
  ]);

  for (const source of [issue, verify]) {
    assert.match(source, /\{ ok: false, error: "invalid_request" \}/);
    assert.match(source, /error instanceof RouteJsonBodyError \? error\.status : 400/);
  }
  assert.match(signup, /let body: unknown = null/);
  assert.match(signup, /parseMemberSignupCompleteInput\(body\)/);
  assert.match(signup, /errorResponse\("invalid_request", error\.status\)/);
  assert.match(moderation, /message: "요청값을 확인해 주세요\."/);
  assert.match(reaction, /message: "반응 종류를 확인해 주세요\."/);
  assert.match(wallet, /return null;/);
  assert.match(wallet, /Apple Wallet 발급 요청을 확인해 주세요\./);
  assert.match(wallet, /Apple Wallet 폐기 요청을 확인해 주세요\./);
  for (const source of [moderation, reaction, wallet]) {
    assert.match(source, /error\.code === "body_too_large"/);
    assert.match(source, /error\.status/);
  }
});
