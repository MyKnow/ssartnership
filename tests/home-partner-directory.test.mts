import assert from "node:assert/strict";
import test from "node:test";
import type { Partner } from "../src/lib/types.ts";

type HomePartnerDirectoryModule = typeof import("../src/lib/home-partner-directory.ts");

const homePartnerDirectoryModulePromise = import(
  new URL("../src/lib/home-partner-directory.ts", import.meta.url).href,
) as Promise<HomePartnerDirectoryModule>;

function createPartner(
  overrides: Omit<Partial<Partner>, "id" | "name"> & Pick<Partner, "id" | "name">,
): Partner {
  const { id, name, ...rest } = overrides;
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    location: "역삼",
    category: "health",
    visibility: "public",
    period: { start: "2026-01-01", end: "2099-12-31" },
    thumbnail: null,
    images: [],
    conditions: [],
    benefits: [],
    appliesTo: ["student"],
    mapUrl: undefined,
    reservationLink: undefined,
    inquiryLink: undefined,
    tags: [],
    ...rest,
  };
}

test("buildHomePartnerDirectory orders the initial server result by popularity", async () => {
  const { buildHomePartnerDirectory } = await homePartnerDirectoryModulePromise;
  const partners = [
    createPartner({
      id: "new-low-score",
      name: "신규 제휴처",
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
    createPartner({
      id: "renewed-high-score",
      name: "소울업짐",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    createPartner({
      id: "middle-score",
      name: "중간 제휴처",
      createdAt: "2026-04-01T00:00:00.000Z",
    }),
  ];

  const result = buildHomePartnerDirectory({
    partners,
    viewerAuthenticated: true,
    popularityByPartnerId: {
      "new-low-score": { favoriteCount: 0, reviewCount: 0, detailViews: 0 },
      "renewed-high-score": { favoriteCount: 2, reviewCount: 0, detailViews: 0 },
      "middle-score": { favoriteCount: 1, reviewCount: 0, detailViews: 0 },
    },
    query: {
      activeCategory: "all",
      appliesToFilter: "all",
      searchValue: "",
      sortValue: "popular",
      limit: 2,
    },
  });

  assert.deepEqual(result.displayPartnerIds, [
    "renewed-high-score",
    "middle-score",
  ]);
  assert.deepEqual(
    result.partners.map((partner) => partner.id),
    ["renewed-high-score", "middle-score"],
  );
  assert.equal(result.totalDisplayCount, 3);
  assert.equal(result.hasMore, true);
});

test("buildHomePartnerDirectory keeps the shared home filters on the server path", async () => {
  const { buildHomePartnerDirectory } = await homePartnerDirectoryModulePromise;
  const partners = [
    createPartner({
      id: "health-student",
      name: "학생 헬스장",
      category: "health",
      benefits: ["PT 할인"],
      appliesTo: ["student"],
    }),
    createPartner({
      id: "cafe-staff",
      name: "스태프 카페",
      category: "cafe",
      benefits: ["커피 할인"],
      appliesTo: ["staff"],
    }),
  ];

  const result = buildHomePartnerDirectory({
    partners,
    viewerAuthenticated: true,
    popularityByPartnerId: {},
    query: {
      activeCategory: "health",
      appliesToFilter: "student",
      searchValue: "pt",
      sortValue: "recent",
    },
  });

  assert.deepEqual(result.displayPartnerIds, ["health-student"]);
  assert.equal(result.totalDisplayCount, 1);
  assert.equal(result.hasMore, false);
});
