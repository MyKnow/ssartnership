import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManagedPromotionSlide,
  PromotionSlideViewer,
} from "../src/lib/promotions/events.ts";
import type { PromotionAudience } from "../src/lib/promotions/catalog.ts";

type PromotionsModule = typeof import("../src/lib/promotions/events.ts");

const promotionsPromise = import(
  new URL("../src/lib/promotions/events.ts", import.meta.url).href
) as Promise<PromotionsModule>;

function createSlide(options: {
  audiences: PromotionAudience[];
  allowedCampuses?: string[];
}): ManagedPromotionSlide {
  return {
    id: "guest-visible-ad",
    title: "게스트 광고",
    description: "게스트에게도 보여야 하는 광고",
    imageSrc: "/ads/guest-visible.svg",
    imageAlt: "게스트 광고",
    href: "/events/guest-visible",
    source: "database",
    displayOrder: 1,
    subtitle: "게스트에게도 보여야 하는 광고",
    isActive: true,
    audiences: options.audiences,
    allowedCampuses: options.allowedCampuses ?? [],
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

test("promotion slides targeted to guests stay visible even with campus restrictions", async () => {
  const { canViewPromotionSlide } = await promotionsPromise;

  const slide = createSlide({
    audiences: ["guest"],
    allowedCampuses: ["seoul"],
  });

  assert.equal(
    canViewPromotionSlide(slide, {
      authenticated: false,
      year: null,
      campus: null,
    }),
    true,
  );
});

test("promotion slide visibility still respects audience and campus for authenticated viewers", async () => {
  const { canViewPromotionSlide } = await promotionsPromise;

  const slide = createSlide({
    audiences: ["student"],
    allowedCampuses: ["seoul"],
  });
  const seoulStudent: PromotionSlideViewer = {
    authenticated: true,
    year: 15,
    campus: "서울",
  };
  const daejeonStudent: PromotionSlideViewer = {
    authenticated: true,
    year: 15,
    campus: "대전",
  };
  const guest: PromotionSlideViewer = {
    authenticated: false,
    year: null,
    campus: null,
  };

  assert.equal(canViewPromotionSlide(slide, seoulStudent), true);
  assert.equal(canViewPromotionSlide(slide, daejeonStudent), false);
  assert.equal(canViewPromotionSlide(slide, guest), false);
});
