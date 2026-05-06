import assert from "node:assert/strict";
import test from "node:test";

type CarouselHelpersModule = typeof import("../src/components/partner-image-carousel/helpers.ts");
type PartnerCardHelpersModule = typeof import("../src/components/partner-card-view/helpers.ts");
type MockPortalStoreModule = typeof import("../src/lib/mock/partner-portal/store.ts");

const carouselHelpersPromise = import(
  new URL("../src/components/partner-image-carousel/helpers.ts", import.meta.url).href,
) as Promise<CarouselHelpersModule>;
const partnerCardHelpersPromise = import(
  new URL("../src/components/partner-card-view/helpers.ts", import.meta.url).href,
) as Promise<PartnerCardHelpersModule>;
const mockPortalStorePromise = import(
  new URL("../src/lib/mock/partner-portal/store.ts", import.meta.url).href,
) as Promise<MockPortalStoreModule>;

test("carousel helpers clamp zoom, normalize indexes, and compute touch distance", async () => {
  const {
    clampCarouselZoom,
    normalizeCarouselIndex,
    getTouchDistance,
  } = await carouselHelpersPromise;

  assert.equal(clampCarouselZoom(0.25), 1);
  assert.equal(clampCarouselZoom(5.5), 4);
  assert.equal(clampCarouselZoom(2.25), 2.25);

  assert.equal(normalizeCarouselIndex(-1, 4), 3);
  assert.equal(normalizeCarouselIndex(5, 4), 1);
  assert.equal(normalizeCarouselIndex(10, 0), 0);

  assert.equal(
    getTouchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }),
    5,
  );
});

test("partner card helpers derive accent styles and CTA presentation", async () => {
  const {
    withAlpha,
    createCategoryAccentStyles,
    createPartnerCardPresentation,
  } = await partnerCardHelpersPromise;

  assert.equal(withAlpha("#112233", "1f"), "#1122331f");
  assert.equal(withAlpha("rgb(0,0,0)", "1f"), "rgb(0,0,0)");

  const accent = createCategoryAccentStyles("#3366ff");
  assert.deepStrictEqual(accent.badgeStyle, {
    backgroundColor: "#3366ff1f",
    color: "#3366ff",
  });

  const activePresentation = createPartnerCardPresentation(
    {
      id: "partner-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      name: "레코디드",
      location: "역삼",
      category: "food",
      visibility: "public",
      period: { start: "2026-01-01", end: "2099-12-31" },
      thumbnail: "https://example.com/thumb.webp",
      images: [],
      conditions: [],
      benefits: [],
      appliesTo: ["student"],
      mapUrl: "https://maps.example.com",
      reservationLink: "https://reserve.example.com",
      inquiryLink: "010-1234-5678",
      tags: [],
    },
    false,
  );

  assert.equal(activePresentation.lockKind, null);
  assert.equal(activePresentation.thumbnailUrl, "https://example.com/thumb.webp");
  assert.equal(activePresentation.isActive, true);
  assert.equal(activePresentation.reservationAction?.label, "혜택 이용");
  assert.equal(activePresentation.inquiryAction?.label, "문의하기");
  assert.equal(activePresentation.detailHref, "/partners/partner-1");

  const inactivePresentation = createPartnerCardPresentation(
    {
      id: "partner-2",
      createdAt: "2026-01-01T00:00:00.000Z",
      name: "비공개 제휴",
      location: "선릉",
      category: "fitness",
      visibility: "confidential",
      period: { start: "2020-01-01", end: "2020-01-31" },
      thumbnail: null,
      images: ["https://example.com/cover.webp"],
      conditions: [],
      benefits: [],
      appliesTo: ["graduate"],
      mapUrl: undefined,
      reservationLink: undefined,
      inquiryLink: undefined,
      tags: [],
    },
    false,
  );

  assert.equal(inactivePresentation.lockKind, "confidential");
  assert.equal(inactivePresentation.thumbnailUrl, "https://example.com/cover.webp");
  assert.equal(inactivePresentation.isActive, false);
  assert.equal(inactivePresentation.reservationAction, null);
});

test("mock partner portal store resets and isolates seeded setup state", async () => {
  const {
    findMockPartnerPortalAccountByEmail,
    getMockPartnerPortalStore,
    resetMockPartnerPortalStore,
  } = await mockPortalStorePromise;

  resetMockPartnerPortalStore();
  const initialStore = getMockPartnerPortalStore();
  assert.equal(initialStore.setups.length > 0, true);

  const firstEmail = initialStore.setups[0]?.account.email ?? "";
  const found = findMockPartnerPortalAccountByEmail(firstEmail.toUpperCase());
  assert.equal(found?.account.email, firstEmail);

  initialStore.setups[0]!.account.displayName = "변경된 이름";
  resetMockPartnerPortalStore();
  const resetStore = getMockPartnerPortalStore();
  assert.notEqual(resetStore.setups[0]?.account.displayName, "변경된 이름");
});
