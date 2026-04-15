import assert from "node:assert/strict";
import test from "node:test";

type SeoModule = typeof import("../src/lib/seo/index.ts");
type PushOpsModule = typeof import("../src/lib/push/ops.ts");

const seoModulePromise = import(
  new URL("../src/lib/seo/index.ts", import.meta.url).href,
) as Promise<SeoModule>;
const pushOpsModulePromise = import(
  new URL("../src/lib/push/ops.ts", import.meta.url).href,
) as Promise<PushOpsModule>;

test("seo helpers normalize canonical paths and omit unstable sitemap metadata by default", async () => {
  const {
    normalizeSeoPath,
    buildSiteUrl,
    createCanonicalAlternates,
    createSitemapEntry,
    getSitemapLocation,
  } = await seoModulePromise;

  assert.equal(normalizeSeoPath("partners/demo"), "/partners/demo");
  assert.equal(normalizeSeoPath("/"), "/");
  assert.equal(buildSiteUrl("/partners/demo").includes("/partners/demo"), true);
  assert.deepStrictEqual(createCanonicalAlternates("/partners/demo"), {
    canonical: "/partners/demo",
  });
  assert.deepStrictEqual(
    createSitemapEntry("/partners/demo", "weekly", 0.7),
    {
      url: buildSiteUrl("/partners/demo"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  );
  assert.equal(getSitemapLocation().endsWith("/sitemap.xml"), true);
});

test("push ops helpers filter visible expiring partners and merge delivery totals", async () => {
  const {
    filterExpiringPartnersForPush,
    getKstDateString,
    mergePushBatchSummary,
    createPushAuditProperties,
  } = await pushOpsModulePromise;

  const today = getKstDateString(0, new Date("2026-04-15T00:00:00.000Z"));
  assert.equal(today, "2026-04-15");

  const filtered = filterExpiringPartnersForPush(
    [
      {
        id: "public-active",
        name: "레코디드",
        period_start: "2026-04-01",
        period_end: "2026-04-22",
        visibility: "public",
      },
      {
        id: "private-active",
        name: "비공개",
        period_start: "2026-04-01",
        period_end: "2026-04-22",
        visibility: "private",
      },
      {
        id: "future",
        name: "미래 제휴",
        period_start: "2026-04-16",
        period_end: "2026-04-22",
        visibility: "public",
      },
    ],
    "2026-04-15",
  );

  assert.deepStrictEqual(filtered.map((partner) => partner.id), ["public-active"]);

  assert.deepStrictEqual(
    mergePushBatchSummary(
      {
        processedPartners: 3,
        targeted: 1,
        delivered: 1,
        failed: 0,
      },
      {
        targeted: 2,
        delivered: 1,
        failed: 1,
      },
    ),
    {
      processedPartners: 3,
      targeted: 3,
      delivered: 2,
      failed: 1,
    },
  );

  assert.deepStrictEqual(
    createPushAuditProperties({
      payload: {
        type: "announcement",
        title: "공지",
        body: "내용",
        url: "/partners/demo",
      },
      audience: { scope: "all" },
      result: { targeted: 10, delivered: 9, failed: 1 },
    }),
    {
      type: "announcement",
      title: "공지",
      hasUrl: true,
      audienceScope: "all",
      audienceYear: null,
      audienceCampus: null,
      audienceMemberId: null,
      destination: "https://ssartnership.vercel.app/partners/demo",
      targeted: 10,
      delivered: 9,
      failed: 1,
    },
  );
});
