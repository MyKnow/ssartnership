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
  eventSlug?: string | null;
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
    eventSlug: options.eventSlug ?? null,
    adCampaignId: null,
    sponsorLabel: "",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

function createCampaign(options: {
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}) {
  return {
    id: "event-1",
    slug: "signup-reward",
    title: "싸트너십 추첨권 이벤트",
    shortTitle: "추첨권 이벤트",
    description: "이벤트",
    periodLabel: "기간",
    startsAt: options.startsAt ?? "2026-05-01T00:00:00+09:00",
    endsAt: options.endsAt ?? "2026-05-31T23:59:59+09:00",
    heroImageSrc: "/ads/reward-event.svg",
    heroImageAlt: "이벤트",
    conditions: [],
    rules: [],
    pagePath: "/events/signup-reward",
    targetAudiences: ["guest", "student", "graduate", "staff"] as PromotionAudience[],
    isActive: options.isActive ?? true,
    source: "database" as const,
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

test("promotion campaign visibility follows active flag and period", async () => {
  const { getPromotionCampaignState, isPromotionCampaignVisible } =
    await promotionsPromise;
  const now = new Date("2026-05-10T12:00:00+09:00");
  const expiredCatalogCampaign = {
    ...createCampaign({
      endsAt: "2026-05-09T23:59:59+09:00",
    }),
    id: null,
    source: "catalog" as const,
  };

  assert.equal(getPromotionCampaignState(null, now).key, "unregistered");
  assert.equal(
    getPromotionCampaignState(createCampaign({ isActive: false }), now).key,
    "inactive",
  );
  assert.equal(
    getPromotionCampaignState(
      createCampaign({ startsAt: "2026-05-20T00:00:00+09:00" }),
      now,
    ).key,
    "upcoming",
  );
  assert.equal(getPromotionCampaignState(createCampaign({}), now).key, "active");
  assert.equal(
    getPromotionCampaignState(
      createCampaign({ endsAt: "2026-05-09T23:59:59+09:00" }),
      now,
    ).key,
    "expired",
  );
  assert.equal(isPromotionCampaignVisible(createCampaign({}), now), true);
  assert.equal(
    isPromotionCampaignVisible(
      createCampaign({ endsAt: "2026-05-09T23:59:59+09:00" }),
      now,
    ),
    false,
  );
  assert.equal(getPromotionCampaignState(expiredCatalogCampaign, now).key, "expired");
  assert.equal(isPromotionCampaignVisible(expiredCatalogCampaign, now), false);
});

test("linked home carousel slides are hidden when the event is no longer visible", async () => {
  const { canDisplayHomePromotionSlide } = await promotionsPromise;
  const viewer = {
    authenticated: false,
    year: null,
    campus: null,
  };
  const linkedSlide = createSlide({
    audiences: ["guest"],
    eventSlug: "signup-reward",
  });
  const unlinkedSlide = createSlide({
    audiences: ["guest"],
    eventSlug: null,
  });
  const campaigns = new Map([
    [
      "signup-reward",
      createCampaign({ endsAt: "2026-05-09T23:59:59+09:00" }),
    ],
  ]);

  assert.equal(
    canDisplayHomePromotionSlide(
      linkedSlide,
      viewer,
      campaigns,
      new Date("2026-05-10T12:00:00+09:00"),
    ),
    false,
  );
  assert.equal(
    canDisplayHomePromotionSlide(
      unlinkedSlide,
      viewer,
      campaigns,
      new Date("2026-05-10T12:00:00+09:00"),
    ),
    true,
  );
});
