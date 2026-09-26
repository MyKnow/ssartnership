import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getSafeAdminActionErrorCode } from "../src/lib/admin-action-errors.ts";
import {
  PROMOTION_SLIDE_ERROR_FIELDS,
  PROMOTION_SLIDE_ERROR_MESSAGES,
  PromotionSlideSaveError,
  formatPromotionSlideError,
  isPromotionSlideErrorCode,
  parsePromotionSlideNumber,
  validatePromotionSlide,
} from "../src/lib/promotions/slide-validation.ts";

const validSlide = {
  title: "내 프로젝트를 소개합니다!",
  subtitle: "SSAFY 구성원이 만든 서비스를 체험해 보세요.",
  href: "/events/project-showcase",
  imageAlt: "프로젝트 쇼케이스",
  audiences: ["guest", "student"],
  sponsorLabel: "",
  hasImage: true,
};

test("광고 카드 검증은 비어 있는 필드마다 필드와 코드를 돌려준다", () => {
  assert.deepEqual(validatePromotionSlide(validSlide), []);
  const issues = validatePromotionSlide({
    ...validSlide,
    title: " ",
    href: "",
    hasImage: false,
    audiences: [],
    sponsorLabel: "가".repeat(61),
  });
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ["title", "image", "href", "audiences", "sponsorLabel"],
  );
  assert.equal(issues[0].message, PROMOTION_SLIDE_ERROR_MESSAGES.promotion_slide_title_required);
});

test("저장 오류 코드는 안전한 redirect 코드로 통과하고 카드 번호와 함께 표시된다", () => {
  for (const code of Object.keys(PROMOTION_SLIDE_ERROR_MESSAGES)) {
    assert.equal(getSafeAdminActionErrorCode(new PromotionSlideSaveError(code as never, 2), "fallback"), code);
    assert.ok(isPromotionSlideErrorCode(code));
  }
  assert.equal(isPromotionSlideErrorCode("promotion_slide_save_failed"), false);
  assert.equal(
    formatPromotionSlideError("promotion_slide_href_required", 2),
    "카드 2: 연결 페이지를 입력해 주세요.",
  );
  assert.equal(PROMOTION_SLIDE_ERROR_FIELDS.promotion_slide_image_attach_failed, "image");
  assert.equal(parsePromotionSlideNumber("3"), 3);
  assert.equal(parsePromotionSlideNumber("0"), null);
  assert.equal(parsePromotionSlideNumber("1e3"), null);
});

test("광고 카드 저장은 promotion_events에 없는 이벤트 slug를 FK 컬럼에 쓰지 않는다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/_actions/promotion-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from\("promotion_events"\)\s*\.select\("slug"\)\s*\.in\("slug", unique\)/);
  assert.match(source, /slide\.eventSlug && registeredEventSlugs\.has\(slide\.eventSlug\)/);
  assert.doesNotMatch(source, /event_slug: slide\.eventSlug,/);
  assert.match(source, /validatePromotionSlide\(/);
});
