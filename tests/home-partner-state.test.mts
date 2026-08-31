import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homePartnerStateModulePromise = import(
  new URL("../src/lib/home-partner-state.ts", import.meta.url).href,
);

function createAdminMetrics(favoriteCount: number) {
  return {
    favoriteCount,
    detailViews: 13,
    detailUv: 0,
    cardClicks: 0,
    mapClicks: 0,
    reservationClicks: 0,
    inquiryClicks: 0,
    benefitUsageCount: 0,
    reviewCount: 3,
    totalClicks: 0,
  };
}

test("normalizeHomePartnerStateIds deduplicates and caps visible partner ids", async () => {
  const { HOME_PARTNER_STATE_BATCH_LIMIT, normalizeHomePartnerStateIds } =
    await homePartnerStateModulePromise;
  const values = [
    " partner-1 ",
    "partner-1",
    "",
    "x".repeat(121),
    ...Array.from({ length: HOME_PARTNER_STATE_BATCH_LIMIT + 5 }, (_, index) =>
      `partner-${index + 2}`,
    ),
  ];

  const ids = normalizeHomePartnerStateIds(values);

  assert.equal(ids.length, HOME_PARTNER_STATE_BATCH_LIMIT);
  assert.equal(ids[0], "partner-1");
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes("x".repeat(121)), false);
});

test("global popularity can cover the full directory while member state stays batch bounded", async () => {
  const {
    HOME_PARTNER_STATE_BATCH_LIMIT,
    getHomePartnerMemberState,
    getHomePartnerPopularityById,
  } = await homePartnerStateModulePromise;
  const partnerIds = Array.from(
    { length: HOME_PARTNER_STATE_BATCH_LIMIT + 6 },
    (_, index) => `partner-${index + 1}`,
  );

  const popularityByPartnerId = await getHomePartnerPopularityById(partnerIds, {
    canUsePopularityMetrics: () => false,
    getAdminPartnerMetrics: async () => {
      throw new Error("admin metrics must stay disabled");
    },
    getFavoriteCounts: async (requestedIds) =>
      new Map(requestedIds.map((partnerId) => [partnerId, 0])),
  });
  const state = await getHomePartnerMemberState({
    partnerIds,
    currentUserId: null,
  });

  assert.equal(Object.keys(popularityByPartnerId).length, partnerIds.length);
  assert.equal(state.loadedPartnerIds.length, HOME_PARTNER_STATE_BATCH_LIMIT);
  assert.deepEqual(state.loadedPartnerIds, partnerIds.slice(0, HOME_PARTNER_STATE_BATCH_LIMIT));
});

test("successful admin metrics reuse their favorite counts without a duplicate fallback query", async () => {
  const { getHomePartnerPopularityById } = await homePartnerStateModulePromise;
  let fallbackCalls = 0;

  const popularity = await getHomePartnerPopularityById(["partner-1"], {
    canUsePopularityMetrics: () => true,
    getAdminPartnerMetrics: async () => ({
      metricsByPartnerId: new Map([["partner-1", createAdminMetrics(7)]]),
      warningMessage: null,
    }),
    getFavoriteCounts: async () => {
      fallbackCalls += 1;
      return new Map([["partner-1", 99]]);
    },
  });

  assert.equal(fallbackCalls, 0);
  assert.deepEqual(popularity["partner-1"], {
    favoriteCount: 7,
    reviewCount: 3,
    detailViews: 13,
  });
});

test("no-metrics mode keeps the favorite-count repository path", async () => {
  const { getHomePartnerPopularityById } = await homePartnerStateModulePromise;
  let fallbackCalls = 0;

  const popularity = await getHomePartnerPopularityById(["partner-1"], {
    canUsePopularityMetrics: () => false,
    getAdminPartnerMetrics: async () => {
      throw new Error("admin metrics must stay disabled");
    },
    getFavoriteCounts: async () => {
      fallbackCalls += 1;
      return new Map([["partner-1", 4]]);
    },
  });

  assert.equal(fallbackCalls, 1);
  assert.deepEqual(popularity["partner-1"], {
    favoriteCount: 4,
    reviewCount: 0,
    detailViews: 0,
  });
});

test("partial admin metrics use the favorite-count fallback", async () => {
  const { getHomePartnerPopularityById } = await homePartnerStateModulePromise;
  let fallbackCalls = 0;

  const popularity = await getHomePartnerPopularityById(["partner-1"], {
    canUsePopularityMetrics: () => true,
    getAdminPartnerMetrics: async () => ({
      metricsByPartnerId: new Map([["partner-1", createAdminMetrics(0)]]),
      warningMessage: "partial",
    }),
    getFavoriteCounts: async () => {
      fallbackCalls += 1;
      return new Map([["partner-1", 11]]);
    },
  });

  assert.equal(fallbackCalls, 1);
  assert.deepEqual(popularity["partner-1"], {
    favoriteCount: 11,
    reviewCount: 3,
    detailViews: 13,
  });
});

test("failed admin metrics use the favorite-count fallback", async () => {
  const { getHomePartnerPopularityById } = await homePartnerStateModulePromise;
  let fallbackCalls = 0;
  const originalError = console.error;
  console.error = () => {};

  try {
    const popularity = await getHomePartnerPopularityById(["partner-1"], {
      canUsePopularityMetrics: () => true,
      getAdminPartnerMetrics: async () => {
        throw new Error("metrics failed");
      },
      getFavoriteCounts: async () => {
        fallbackCalls += 1;
        return new Map([["partner-1", 5]]);
      },
    });

    assert.equal(fallbackCalls, 1);
    assert.deepEqual(popularity["partner-1"], {
      favoriteCount: 5,
      reviewCount: 0,
      detailViews: 0,
    });
  } finally {
    console.error = originalError;
  }
});

test("home partner state starts independent data sources in parallel", () => {
  const source = readFileSync(
    new URL("../src/lib/home-partner-state.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /await Promise\.all\(\[popularityPromise, memberStatePromise\]\)/);
});
