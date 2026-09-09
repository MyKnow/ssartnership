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

test("loadHomePartnerDirectory keeps global popularity ordering while preloading only the first 24 member states", async () => {
  const { HOME_PARTNER_STATE_BATCH_LIMIT } = await import(
    new URL("../src/lib/home-partner-state.ts", import.meta.url).href
  );
  const { loadHomePartnerDirectory } = await homePartnerDirectoryModulePromise;
  const partners = Array.from({ length: HOME_PARTNER_STATE_BATCH_LIMIT + 6 }, (_, index) =>
    createPartner({
      id: `partner-${index + 1}`,
      name: `제휴처 ${index + 1}`,
      category: index === 28 ? "cafe" : "health",
    }),
  );
  const popularityRequests: string[][] = [];
  const memberStateRequests: string[][] = [];

  const directory = await loadHomePartnerDirectory(
    {
      viewerAuthenticated: true,
      currentUserId: "member-1",
      query: { activeCategory: "health" },
    },
    {
      getCategories: async () => [],
      getPartners: async () => partners,
      getPublicDirectoryPartners: async () => partners,
      getPopularityByPartnerId: async (partnerIds) => {
        popularityRequests.push(partnerIds);
        return Object.fromEntries(
          partnerIds.map((partnerId) => [partnerId, {
            favoriteCount: partnerId === "partner-30" ? 100 : 0,
            reviewCount: 0,
            detailViews: 0,
          }]),
        );
      },
      getMemberState: async ({ partnerIds }) => {
        memberStateRequests.push(partnerIds);
        return { loadedFavoritePartnerIds: partnerIds, partnerFavoriteStateById: {} };
      },
    },
  );

  assert.deepEqual(popularityRequests, [partners.map((partner) => partner.id)]);
  assert.equal(popularityRequests[0].includes("partner-29"), true);
  assert.equal(directory.displayPartnerIds.includes("partner-29"), false);
  assert.equal(directory.displayPartnerIds[0], "partner-30");
  assert.equal(memberStateRequests[0].length, HOME_PARTNER_STATE_BATCH_LIMIT);
  assert.deepEqual(memberStateRequests[0], directory.displayPartnerIds.slice(0, 24));
  assert.equal(memberStateRequests[0][0], "partner-30");
  assert.equal(memberStateRequests[0].includes("partner-24"), false);
  assert.deepEqual(directory.partnerState.loadedFavoritePartnerIds, memberStateRequests[0]);
});

test("loadHomePartnerDirectory uses the lean public directory loader for logged out viewers", async () => {
  const { loadHomePartnerDirectory } = await homePartnerDirectoryModulePromise;
  let getPartnersCalls = 0;
  let getPublicDirectoryPartnersCalls = 0;

  await loadHomePartnerDirectory(
    {
      viewerAuthenticated: false,
      currentUserId: null,
    },
    {
      getCategories: async () => [],
      getPartners: async () => {
        getPartnersCalls += 1;
        return [];
      },
      getPublicDirectoryPartners: async () => {
        getPublicDirectoryPartnersCalls += 1;
        return [];
      },
      getPopularityByPartnerId: async () => ({}),
      getMemberState: async () => ({
        loadedFavoritePartnerIds: [],
        partnerFavoriteStateById: {},
      }),
    },
  );

  assert.equal(getPartnersCalls, 0);
  assert.equal(getPublicDirectoryPartnersCalls, 1);
});

test("loadHomePartnerDirectoryState converts an unavailable repository into a recoverable state", async () => {
  const { loadHomePartnerDirectoryState } = await homePartnerDirectoryModulePromise;
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    const result = await loadHomePartnerDirectoryState(
      {
        viewerAuthenticated: false,
        currentUserId: null,
      },
      async () => {
        const cause = Object.assign(
          new Error(
            "connection to postgresql://preview_user:database-password@db.supabase.co failed",
          ),
          { code: "ENOTFOUND" },
        );
        throw Object.assign(
          new TypeError("fetch failed; token=database-credential"),
          { cause },
        );
      },
    );

    assert.deepEqual(result, { status: "unavailable" });
    assert.deepEqual(errors, [
      ["[home-partner-directory] directory unavailable", {
        reasonCode: "directory_load_failed",
        errorName: "TypeError",
        errorMessage: "fetch failed; token=[redacted]",
        causeName: "Error",
        causeMessage: "connection to postgresql://[redacted]@db.supabase.co failed",
        causeCode: "ENOTFOUND",
      }],
    ]);
    assert.doesNotMatch(
      JSON.stringify(errors),
      /database-credential|database-password|preview_user/,
    );
  } finally {
    console.error = originalError;
  }
});

test("loadHomePartnerDirectoryState preserves Next.js control-flow errors", async () => {
  const { loadHomePartnerDirectoryState } = await homePartnerDirectoryModulePromise;
  const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/login;307;",
  });

  await assert.rejects(
    loadHomePartnerDirectoryState(
      {
        viewerAuthenticated: false,
        currentUserId: null,
      },
      async () => {
        throw redirectError;
      },
    ),
    (error) => error === redirectError,
  );
});

test("loadHomePartnerDirectoryState preserves a successful directory result", async () => {
  const { loadHomePartnerDirectoryState } = await homePartnerDirectoryModulePromise;
  const directory = {
    categories: [],
    partners: [],
    displayPartnerIds: [],
    visiblePartnerIds: [],
    lockedPartnerIds: [],
    totalDisplayCount: 0,
    hasMore: false,
    partnerState: {
      loadedFavoritePartnerIds: [],
      partnerFavoriteStateById: {},
      partnerPopularityById: {},
    },
    query: {
      activeCategory: "all" as const,
      appliesToFilter: "all" as const,
      searchValue: "",
      sortValue: "popular" as const,
    },
  };

  const result = await loadHomePartnerDirectoryState(
    {
      viewerAuthenticated: false,
      currentUserId: null,
    },
    async () => directory,
  );

  assert.deepEqual(result, { status: "ready", directory });
});
