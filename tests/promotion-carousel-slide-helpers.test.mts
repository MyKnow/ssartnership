import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type SlideHelpersModule =
  typeof import("../src/components/admin/promotion-carousel-editor/slide-helpers.ts");

const modulePromise = import(
  new URL(
    "../src/components/admin/promotion-carousel-editor/slide-helpers.ts",
    import.meta.url,
  ).href
) as Promise<SlideHelpersModule>;

async function createSlide(id: string, overrides: Record<string, unknown> = {}) {
  const { createEmptySlideDraft } = await modulePromise;
  return { ...createEmptySlideDraft(id), ...overrides };
}

test("광고 카드 대상·캠퍼스 토글은 중복 없이 추가하고 해제한다", async () => {
  const { toggleAudience, toggleCampus } = await modulePromise;

  assert.deepEqual(toggleAudience(["guest"], "staff", true), ["guest", "staff"]);
  assert.deepEqual(toggleAudience(["guest", "staff"], "staff", true), ["guest", "staff"]);
  assert.deepEqual(toggleAudience(["guest", "staff"], "guest", false), ["staff"]);
  assert.deepEqual(toggleCampus(["seoul"], "seoul", false), []);
  assert.deepEqual(toggleCampus([], "seoul", true), ["seoul"]);
});

test("광고 카드 순서 이동은 범위를 벗어나면 그대로 둔다", async () => {
  const { moveSlideInList } = await modulePromise;
  const slides = [await createSlide("a"), await createSlide("b"), await createSlide("c")];

  assert.deepEqual(moveSlideInList(slides, "b", -1).map((slide) => slide.id), ["b", "a", "c"]);
  assert.deepEqual(moveSlideInList(slides, "b", 1).map((slide) => slide.id), ["a", "c", "b"]);
  assert.equal(moveSlideInList(slides, "a", -1), slides);
  assert.equal(moveSlideInList(slides, "c", 1), slides);
  assert.equal(moveSlideInList(slides, "missing", 1), slides);
});

test("연결 페이지에서 이벤트 slug를 추출한다", async () => {
  const { extractEventSlugFromHref } = await modulePromise;

  assert.equal(extractEventSlugFromHref(" /events/signup-reward "), "signup-reward");
  assert.equal(extractEventSlugFromHref("/events/project-showcase?from=home"), "project-showcase");
  assert.equal(extractEventSlugFromHref("/partners/1"), null);
  assert.equal(extractEventSlugFromHref("/events/Bad_Slug"), null);
});

test("저장 직렬화는 파일 객체를 제외하고 업로드 대기 카드만 업로드한다", async () => {
  const { collectPendingSlideUploads, serializePromotionSlidesForSubmit } =
    await modulePromise;
  const file = new File(["image"], "slide.webp", { type: "image/webp" });
  const slides = [
    await createSlide("pending", { imageFile: file }),
    await createSlide("uploaded", { imageFile: file, uploadId: "upload-1" }),
    await createSlide("plain"),
  ];

  assert.deepEqual(
    collectPendingSlideUploads(slides).map((upload) => [upload.clientId, upload.role]),
    [["pending", "slide"]],
  );
  const serialized = JSON.parse(serializePromotionSlidesForSubmit(slides));
  assert.equal(serialized.length, 3);
  assert.equal("imageFile" in serialized[0], false);
  assert.equal(serialized[1].uploadId, "upload-1");
  assert.equal(serialized[2].uploadId, null);
});

test("미리보기는 활성 카드만 홈 배너 기본 문구로 보여 준다", async () => {
  const { buildPromotionPreviewSlides } = await modulePromise;
  const preview = buildPromotionPreviewSlides([
    await createSlide("active"),
    await createSlide("inactive", { isActive: false }),
  ]);

  assert.deepEqual(preview.map((slide) => slide.id), ["active"]);
  assert.equal(preview[0]?.title, "광고 카드");
  assert.equal(preview[0]?.href, "#");
  assert.equal(preview[0]?.imageAlt, "광고 카드 이미지");
});

test("캐러셀 편집기는 하위 컴포넌트·훅으로 분리되고 권한 분기를 유지한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/admin/promotion-carousel-editor/PromotionCarouselEditor.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.ok(source.split("\n").length < 400);
  assert.match(source, /usePromotionSlides\(\{ initialSlides, canUpdate \}\)/);
  assert.match(source, /usePromotionCarouselDraft\(\{/);
  assert.match(source, /<PromotionSlideCard/);
  assert.match(source, /<PromotionCarouselPreviewCard/);
});
