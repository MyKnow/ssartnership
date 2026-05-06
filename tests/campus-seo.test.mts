import assert from "node:assert/strict";
import test from "node:test";

type CampusesModule = typeof import("../src/lib/campuses.ts");
type CampusSeoModule = typeof import("../src/lib/seo/campuses.ts");
type PartnerSeoModule = typeof import("../src/lib/seo/partners.ts");

const campusesModulePromise = import(
  new URL("../src/lib/campuses.ts", import.meta.url).href,
) as Promise<CampusesModule>;
const campusSeoModulePromise = import(
  new URL("../src/lib/seo/campuses.ts", import.meta.url).href,
) as Promise<CampusSeoModule>;
const partnerSeoModulePromise = import(
  new URL("../src/lib/seo/partners.ts", import.meta.url).href,
) as Promise<PartnerSeoModule>;

test("campus helpers infer campus slugs and summarize partner counts", async () => {
  const {
    inferCampusSlugsFromLocation,
    getCampusSummaries,
    resolveFormCampusSlugs,
    validateFormCampusSlugSelection,
  } = await campusesModulePromise;

  assert.deepStrictEqual(
    inferCampusSlugsFromLocation("서울 강남구 역삼동"),
    ["seoul"],
  );
  assert.deepStrictEqual(
    inferCampusSlugsFromLocation("전국 온·오프라인 이용 가능"),
    [
      "seoul",
      "gumi",
      "daejeon",
      "busan-ulsan-gyeongnam",
      "gwangju",
    ],
  );
  assert.deepStrictEqual(
    inferCampusSlugsFromLocation("등록된 병원 전 지점"),
    [
      "seoul",
      "gumi",
      "daejeon",
      "busan-ulsan-gyeongnam",
      "gwangju",
    ],
  );

  const summaries = getCampusSummaries([
    { location: "서울 강남구 역삼동" },
    { location: "경북 구미시 송정동" },
    { location: "전국" },
    { location: "서울 강남구 역삼동", campusSlugs: ["gumi"] },
  ]);

  assert.equal(summaries.find((campus) => campus.slug === "seoul")?.partnerCount, 2);
  assert.equal(summaries.find((campus) => campus.slug === "gumi")?.partnerCount, 3);
  assert.equal(summaries.find((campus) => campus.slug === "daejeon")?.partnerCount, 1);

  assert.deepStrictEqual(
    resolveFormCampusSlugs([], "등록된 병원 전 지점"),
    [],
  );
  assert.deepStrictEqual(
    resolveFormCampusSlugs(["seoul", "invalid", "seoul", "gumi"], ""),
    ["seoul", "gumi"],
  );
  assert.deepStrictEqual(
    validateFormCampusSlugSelection([], "등록된 병원 전 지점"),
    { ok: false, campusSlugs: [] },
  );
  assert.deepStrictEqual(
    validateFormCampusSlugSelection(["seoul", "invalid", "seoul"], ""),
    { ok: true, campusSlugs: ["seoul"] },
  );
});

test("campus seo helpers include campus and category context", async () => {
  const { buildCampusSeoMetadata, buildCampusStructuredData } =
    await campusSeoModulePromise;

  const metadata = buildCampusSeoMetadata({
    campusSlug: "gumi",
    partnerCount: 4,
    categoryLabels: ["카페", "헬스", "식당"],
  });

  assert.equal(
    metadata?.title.includes("구미 캠퍼스"),
    true,
  );
  assert.equal(
    metadata?.description.includes("4개의 공개 제휴"),
    true,
  );
  assert.equal(
    metadata?.keywords.includes("구미 카페 제휴"),
    true,
  );

  const structuredData = buildCampusStructuredData({
    campusSlug: "gumi",
    categoryLabels: ["카페", "헬스"],
    partners: [
      {
        id: "partner-1",
        name: "레코디드",
        category: "cafe",
        location: "경북 구미시",
      },
    ],
  });

  const collectionPage = structuredData?.["@graph"]?.[0] as Record<string, unknown>;
  assert.equal(collectionPage?.["@type"], "CollectionPage");
  assert.equal(String(collectionPage?.keywords).includes("카페"), true);
});

test("partner seo helpers build campus-aware metadata and structured data", async () => {
  const {
    buildPartnerSeoMetadata,
    buildPartnerStructuredData,
    getPartnerCampusAudienceText,
  } = await partnerSeoModulePromise;

  assert.equal(
    getPartnerCampusAudienceText("경북 구미시 봉곡동"),
    "구미 캠퍼스",
  );
  assert.equal(
    getPartnerCampusAudienceText("전국 온라인 이용 가능"),
    "전국 SSAFY 캠퍼스",
  );

  const metadata = buildPartnerSeoMetadata({
    categoryLabel: "카페",
    partner: {
      id: "partner-1",
      name: "레코디드",
      location: "경북 구미시 봉곡동",
      benefits: ["아메리카노 20% 할인"],
      conditions: ["학생증 제시"],
      tags: ["카페", "디저트"],
      thumbnail: "/icon-512.png",
      images: ["/icon-512.png"],
      mapUrl: "https://map.naver.com/p/test",
      period: {
        start: "2026-04-01",
        end: "2026-05-31",
      },
    },
  });

  assert.equal(metadata.title.includes("구미 캠퍼스"), true);
  assert.equal(metadata.description.includes("아메리카노 20% 할인"), true);
  assert.equal(metadata.keywords.includes("구미 SSAFY 제휴"), true);

  const structuredData = buildPartnerStructuredData({
    categoryLabel: "카페",
    partner: {
      id: "partner-1",
      name: "레코디드",
      location: "경북 구미시 봉곡동",
      benefits: ["아메리카노 20% 할인"],
      conditions: ["학생증 제시"],
      tags: ["카페", "디저트"],
      thumbnail: "/icon-512.png",
      images: ["/icon-512.png"],
      mapUrl: "https://map.naver.com/p/test",
      period: {
        start: "2026-04-01",
        end: "2026-05-31",
      },
    },
  });

  const localBusiness = structuredData["@graph"][0] as Record<string, unknown>;
  const offer = structuredData["@graph"][1] as Record<string, unknown>;

  assert.equal(localBusiness["@type"], "LocalBusiness");
  assert.equal(String(localBusiness.keywords).includes("구미 캠퍼스 카페"), true);
  assert.equal(Array.isArray(localBusiness.about), true);
  assert.equal(offer["@type"], "Offer");
  assert.equal(String(offer.eligibleRegion).includes("구미 캠퍼스"), true);
});
