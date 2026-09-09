import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const safeRequestErrorModulePromise = import(
  "../src/lib/client-safe-request-error.ts"
);

test("즐겨찾기 요청은 브라우저 네트워크 오류 원문을 노출하지 않는다", async () => {
  const { ClientSafeRequestError, getClientSafeRequestError } =
    await safeRequestErrorModulePromise;

  const error = getClientSafeRequestError(
    new TypeError("Failed to fetch"),
    {
      requestFailed: "즐겨찾기를 처리하지 못했습니다.",
      networkUnavailable:
        "즐겨찾기를 처리하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
    },
  );

  assert.ok(error instanceof ClientSafeRequestError);
  assert.equal(error.code, "network_unavailable");
  assert.equal(
    error.message,
    "즐겨찾기를 처리하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  );
  assert.doesNotMatch(error.message, /Failed to fetch/);
});

test("리뷰 요청은 네트워크 오류와 알 수 없는 오류를 안전한 문구로 구분한다", async () => {
  const { getClientSafeRequestError } = await safeRequestErrorModulePromise;
  const messages = {
    requestFailed: "리뷰 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    networkUnavailable:
      "리뷰 등록에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
  };

  const networkError = getClientSafeRequestError(
    new TypeError("Failed to fetch"),
    messages,
  );
  const unknownError = getClientSafeRequestError(
    new Error("relation partner_reviews is unavailable"),
    messages,
  );

  assert.equal(networkError.code, "network_unavailable");
  assert.equal(networkError.message, messages.networkUnavailable);
  assert.doesNotMatch(networkError.message, /Failed to fetch/);
  assert.equal(unknownError.code, "request_failed");
  assert.equal(unknownError.message, messages.requestFailed);
  assert.doesNotMatch(unknownError.message, /partner_reviews/);
});

test("안전한 HTTP 응답 메시지는 공통 오류 경계를 지나도 유지된다", async () => {
  const { ClientSafeRequestError, getClientSafeRequestError } =
    await safeRequestErrorModulePromise;
  const serverError = new ClientSafeRequestError(
    "request_failed",
    "로그인 후 이용해 주세요.",
  );

  assert.equal(
    getClientSafeRequestError(serverError, {
      requestFailed: "요청에 실패했습니다.",
      networkUnavailable: "네트워크 연결을 확인해 주세요.",
    }).message,
    "로그인 후 이용해 주세요.",
  );
});

test("파트너 상호작용 UI는 공통 안전 오류 경계를 사용하고 caught error 원문을 노출하지 않는다", async () => {
  const paths = [
    "../src/components/partner-favorites/PartnerFavoriteButton.tsx",
    "../src/components/partner-reviews/PartnerReviewForm.tsx",
    "../src/components/partner-reviews/PartnerReviewSection.tsx",
    "../src/app/(site)/partners/[id]/_page/PartnerDetailCoupons.tsx",
    "../src/components/partner/PartnerBenefitVerificationView.tsx",
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /getClientSafeRequestError/);
    assert.doesNotMatch(
      source,
      /error instanceof Error\s*(?:&&\s*error\.message\s*)?\?\s*error\.message/,
    );
  }

  for (const source of [sources[0], sources[2], sources[3], sources[4]]) {
    assert.match(source, /ClientSafeRequestError/);
  }
});
