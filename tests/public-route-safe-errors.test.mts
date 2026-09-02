import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getSafePublicRouteError } from "../src/lib/public-route-safe-errors.ts";

test("공개 API는 내부 오류 원문 대신 fallback을 반환한다", () => {
  assert.deepEqual(
    getSafePublicRouteError(
      new Error("relation partner_reviews does not exist"),
      "리뷰 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    {
      message: "리뷰 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      status: 503,
    },
  );
});

test("공개 API는 계약된 리뷰 상태 오류만 그대로 유지한다", () => {
  assert.deepEqual(
    getSafePublicRouteError(
      new Error("리뷰를 찾을 수 없습니다."),
      "리뷰 반응에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    {
      message: "리뷰를 찾을 수 없습니다.",
      status: 404,
    },
  );
  assert.deepEqual(
    getSafePublicRouteError(
      new Error("비공개 처리된 리뷰에는 반응할 수 없습니다."),
      "리뷰 반응에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    {
      message: "비공개 처리된 리뷰에는 반응할 수 없습니다.",
      status: 409,
    },
  );
});

test("공개 파트너 리뷰·즐겨찾기 API는 raw error.message 응답을 금지한다", async () => {
  const root = new URL("..", import.meta.url);
  const paths = [
    "src/app/api/partners/[id]/favorite/route.ts",
    "src/app/api/partners/[id]/reviews/route.ts",
    "src/app/api/partners/[id]/reviews/[reviewId]/route.ts",
    "src/app/api/partners/[id]/reviews/[reviewId]/reaction/route.ts",
  ];

  const sources = await Promise.all(
    paths.map((path) => readFile(new URL(path, root), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /getSafePublicRouteError/);
    assert.doesNotMatch(source, /error instanceof Error[^\n]*error\.message/);
    assert.doesNotMatch(source, /message\.includes\("찾을 수 없습니다\."\)/);
  }
});
