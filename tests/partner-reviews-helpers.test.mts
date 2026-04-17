import assert from "node:assert/strict";
import test from "node:test";

type PartnerReviewSharedModule = typeof import("../src/lib/partner-reviews/shared.ts");
type ReviewMediaModule = typeof import("../src/lib/review-media.ts");
type ReviewValidationModule = typeof import("../src/lib/review-validation.ts");

const partnerReviewSharedPromise = import(
  new URL("../src/lib/partner-reviews/shared.ts", import.meta.url).href,
) as Promise<PartnerReviewSharedModule>;
const reviewMediaPromise = import(
  new URL("../src/lib/review-media.ts", import.meta.url).href,
) as Promise<ReviewMediaModule>;
const reviewValidationPromise = import(
  new URL("../src/lib/review-validation.ts", import.meta.url).href,
) as Promise<ReviewValidationModule>;

test("partner review helpers build summary and mask author labels", async () => {
  const {
    buildPartnerReviewSummary,
    maskPartnerReviewAuthorName,
    getPartnerReviewAuthorRoleLabel,
    normalizePartnerReviewSort,
  } = await partnerReviewSharedPromise;

  const summary = buildPartnerReviewSummary([5, 4, 4, 1]);
  assert.equal(summary.averageRating, 3.5);
  assert.equal(summary.totalCount, 4);
  assert.equal(summary.distribution[5], 1);
  assert.equal(summary.distribution[4], 2);
  assert.equal(summary.distribution[1], 1);

  assert.equal(maskPartnerReviewAuthorName("김민재"), "김**");
  assert.equal(maskPartnerReviewAuthorName("가"), "가*");
  assert.equal(getPartnerReviewAuthorRoleLabel(0), "운영진");
  assert.equal(getPartnerReviewAuthorRoleLabel(15), "15기 교육생");
  assert.equal(normalizePartnerReviewSort("oldest"), "oldest");
  assert.equal(normalizePartnerReviewSort("rating_desc"), "rating_desc");
  assert.equal(normalizePartnerReviewSort("something-else"), "latest");
});

test("review media manifest parser accepts existing and upload entries", async () => {
  const { parseReviewMediaManifest } = await reviewMediaPromise;

  const parsed = parseReviewMediaManifest(
    JSON.stringify({
      images: [
        { kind: "existing", url: "https://example.com/review.webp" },
        { kind: "upload" },
      ],
    }),
  );

  assert.equal(parsed?.images.length, 2);
  assert.equal(parsed?.images[0]?.kind, "existing");
  assert.equal(parsed?.images[1]?.kind, "upload");
  assert.equal(parseReviewMediaManifest("{invalid"), null);
});

test("review draft validation trims and rejects invalid fields on the client rule set", async () => {
  const {
    normalizeReviewDraftInput,
    validateReviewDraftInput,
  } = await reviewValidationPromise;

  assert.deepEqual(
    normalizeReviewDraftInput({
      rating: 5,
      title: "  좋아요  ",
      body: "  내용이 충분히 길면 됩니다.  ",
    }),
    {
      rating: 5,
      title: "좋아요",
      body: "내용이 충분히 길면 됩니다.",
    },
  );

  const fieldErrors = validateReviewDraftInput({
    rating: 0,
    title: "",
    body: "짧음",
    imageCount: 6,
  });

  assert.equal(fieldErrors.rating, "별점은 1점부터 5점까지 선택해 주세요.");
  assert.equal(fieldErrors.title, "제목을 입력해 주세요.");
  assert.equal(fieldErrors.body, "리뷰 내용은 10자 이상 입력해 주세요.");
  assert.equal(fieldErrors.images, "리뷰 사진은 최대 5장까지 업로드할 수 있습니다.");
});
