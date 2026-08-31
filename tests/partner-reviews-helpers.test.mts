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
    getPartnerReviewRatingLabel,
    matchesPartnerReviewRatingFilter,
    normalizePartnerReviewRatingFilter,
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
  assert.equal(getPartnerReviewRatingLabel("all"), "전체 별점");
  assert.equal(getPartnerReviewRatingLabel("4"), "4점");
  assert.equal(normalizePartnerReviewSort("oldest"), "oldest");
  assert.equal(normalizePartnerReviewSort("rating_desc"), "rating_desc");
  assert.equal(normalizePartnerReviewSort("something-else"), "latest");
  assert.equal(normalizePartnerReviewRatingFilter("5"), "5");
  assert.equal(normalizePartnerReviewRatingFilter("something-else"), "all");
  assert.equal(matchesPartnerReviewRatingFilter(5, "5"), true);
  assert.equal(matchesPartnerReviewRatingFilter(4, "5"), false);
});

test("review media manifest parser accepts serialized and JSON object entries", async () => {
  const {
    parseReviewMediaManifest,
    parseReviewMediaManifestValue,
  } = await reviewMediaPromise;

  const parsed = parseReviewMediaManifest(
    JSON.stringify({
      images: [
        { kind: "existing", url: "https://example.com/review.webp" },
        { kind: "upload", uploadId: "03f5459b-dfee-4558-907a-509a396312f5" },
      ],
    }),
  );

  assert.equal(parsed?.images.length, 2);
  assert.equal(parsed?.images[0]?.kind, "existing");
  assert.equal(parsed?.images[1]?.kind, "upload");
  assert.equal(parsed?.images[1]?.kind === "upload" ? parsed.images[1].uploadId : null, "03f5459b-dfee-4558-907a-509a396312f5");
  assert.equal(parseReviewMediaManifest("{invalid"), null);
  assert.deepEqual(
    parseReviewMediaManifestValue({
      images: [
        { kind: "upload", uploadId: "13f5459b-dfee-4558-907a-509a396312f5" },
      ],
    }),
    {
      images: [
        { kind: "upload", uploadId: "13f5459b-dfee-4558-907a-509a396312f5" },
      ],
    },
  );
  assert.equal(parseReviewMediaManifestValue({ images: [{ kind: "upload" }] }), null);
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

test("review submission builder and parser share the bounded JSON contract", async () => {
  const {
    buildReviewSubmissionRequest,
    parseReviewSubmissionRequest,
  } = await reviewValidationPromise;

  const request = buildReviewSubmissionRequest({
    reviewId: "03f5459b-dfee-4558-907a-509a396312f5",
    rating: 5,
    title: "  시설이 깔끔해요  ",
    body: "  운동 기구와 샤워실이 모두 깔끔했습니다.  ",
    images: [
      { kind: "upload", uploadId: "13f5459b-dfee-4558-907a-509a396312f5" },
    ],
  });
  const parsed = parseReviewSubmissionRequest(request);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.values.reviewId, request.reviewId);
  assert.equal(parsed.values.title, "시설이 깔끔해요");
  assert.equal(parsed.values.body, "운동 기구와 샤워실이 모두 깔끔했습니다.");
  assert.deepEqual(parsed.values.imagesManifest, request.imagesManifest);
});

test("review submission parser separates malformed body from field validation", async () => {
  const { parseReviewSubmissionRequest } = await reviewValidationPromise;

  assert.deepEqual(parseReviewSubmissionRequest(null), {
    ok: false,
    reason: "invalid_body",
  });
  assert.deepEqual(
    parseReviewSubmissionRequest({
      rating: 5,
      title: "시설이 깔끔해요",
      body: "운동 기구와 샤워실이 모두 깔끔했습니다.",
      imagesManifest: { images: [{ kind: "upload" }] },
    }),
    {
      ok: false,
      reason: "invalid_fields",
      fieldErrors: { images: "리뷰 사진 형식을 확인해 주세요." },
    },
  );

  const invalidFields = parseReviewSubmissionRequest({
    rating: 0,
    title: "",
    body: "짧음",
    imagesManifest: { images: [] },
  });
  assert.equal(invalidFields.ok, false);
  assert.equal(
    !invalidFields.ok && invalidFields.reason === "invalid_fields"
      ? invalidFields.fieldErrors.rating
      : null,
    "별점은 1점부터 5점까지 선택해 주세요.",
  );

  const withoutClientReviewId = parseReviewSubmissionRequest({
    rating: 5,
    title: "시설이 깔끔해요",
    body: "운동 기구와 샤워실이 모두 깔끔했습니다.",
    imagesManifest: { images: [] },
  });
  assert.equal(withoutClientReviewId.ok, true);
  if (withoutClientReviewId.ok) {
    assert.equal(withoutClientReviewId.values.reviewId, null);
  }
});
