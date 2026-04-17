import assert from "node:assert/strict";
import test from "node:test";

type PartnerReviewSharedModule = typeof import("../src/lib/partner-reviews/shared.ts");
type ReviewMediaModule = typeof import("../src/lib/review-media.ts");

const partnerReviewSharedPromise = import(
  new URL("../src/lib/partner-reviews/shared.ts", import.meta.url).href,
) as Promise<PartnerReviewSharedModule>;
const reviewMediaPromise = import(
  new URL("../src/lib/review-media.ts", import.meta.url).href,
) as Promise<ReviewMediaModule>;

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
