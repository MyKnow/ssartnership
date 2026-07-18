import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/components/admin/promotion-carousel-editor/draft.ts");

test("프로모션 초안은 WebP 업로드 ID와 텍스트를 보존하고 blob URL은 저장하지 않는다", async () => {
  const { readPromotionCarouselDraft, serializePromotionCarouselDraft } = await modulePromise;
  const raw = serializePromotionCarouselDraft([{
    id: "slide-1",
    title: "여름 제휴",
    subtitle: "한정 혜택",
    imageSrc: "blob:temporary-preview",
    hasImageFile: true,
    uploadId: "03f5459b-dfee-4558-907a-509a396312f5",
    imageAlt: "여름 제휴 배너",
    href: "/events/summer",
    isActive: true,
    audiences: ["guest"],
    allowedCampuses: ["seoul"],
    eventSlug: "summer",
    adCampaignId: null,
    sponsorLabel: "싸트너십",
    source: "database",
  }]);
  const [slide] = readPromotionCarouselDraft(raw) ?? [];

  assert.equal(slide?.imageSrc, "");
  assert.equal(slide?.uploadId, "03f5459b-dfee-4558-907a-509a396312f5");
  assert.equal(slide?.title, "여름 제휴");
});

test("프로모션 초안은 중복 카드 ID와 잘못된 업로드 ID를 거부한다", async () => {
  const { readPromotionCarouselDraft } = await modulePromise;
  assert.equal(readPromotionCarouselDraft(JSON.stringify([
    { id: "same", audiences: [], source: "database" },
    { id: "same", audiences: [], source: "database" },
  ])), null);
  assert.equal(readPromotionCarouselDraft(JSON.stringify([
    { id: "slide", uploadId: "invalid", audiences: [], source: "database" },
  ])), null);
});
