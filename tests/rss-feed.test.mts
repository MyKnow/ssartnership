import assert from "node:assert/strict";
import test from "node:test";
import { buildRssFeedXml, type RssFeedItem } from "@/lib/rss.ts";
import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { buildSiteUrl } from "@/lib/seo";

// The feed module picks its repository when it is first loaded.
process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
const { buildPartnerRssFeedXml, toPartnerRssFeedItems } = await import("@/lib/rss/feed");

const channel = {
  title: "피드",
  link: "https://ssartnership.test/",
  description: "설명",
};

function item(overrides: Partial<RssFeedItem>): RssFeedItem {
  return {
    title: "제휴",
    link: "https://ssartnership.test/partners/p-1",
    description: "공개 제휴",
    ...overrides,
  };
}

function tagValues(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map((match) => match[1]);
}

test("item dates come from the data and the build date from the newest item", () => {
  const xml = buildRssFeedXml({
    ...channel,
    items: [
      item({ link: "https://ssartnership.test/partners/a", pubDate: "2026-03-01T00:00:00.000Z" }),
      item({ link: "https://ssartnership.test/partners/b", pubDate: new Date("2026-07-01T09:30:00+09:00") }),
    ],
  });

  assert.deepEqual(tagValues(xml, "pubDate"), [
    "Sun, 01 Mar 2026 00:00:00 GMT",
    "Wed, 01 Jul 2026 00:30:00 GMT",
  ]);
  assert.deepEqual(tagValues(xml, "lastBuildDate"), ["Wed, 01 Jul 2026 00:30:00 GMT"]);
});

test("unknown dates are left out instead of using the request time", () => {
  const xml = buildRssFeedXml({
    ...channel,
    items: [
      item({ link: "https://ssartnership.test/partners/a", pubDate: null }),
      item({ link: "https://ssartnership.test/partners/b", pubDate: "not-a-date" }),
      item({ link: "https://ssartnership.test/partners/c" }),
    ],
  });

  assert.deepEqual(tagValues(xml, "pubDate"), []);
  assert.deepEqual(tagValues(xml, "lastBuildDate"), []);
  assert.equal(xml.match(/<item>/g)?.length, 3);
});

test("an explicit build date overrides the newest item date", () => {
  const xml = buildRssFeedXml({
    ...channel,
    items: [item({ pubDate: "2026-03-01T00:00:00.000Z" })],
    lastBuildDate: "2026-09-01T00:00:00.000Z",
  });

  assert.deepEqual(tagValues(xml, "lastBuildDate"), ["Tue, 01 Sep 2026 00:00:00 GMT"]);
});

test("partner items use the registration time as pubDate", async () => {
  const partners = await new MockPartnerRepository().getPublicPartnerSeoEntries();
  assert.ok(partners.length > 0);
  const items = toPartnerRssFeedItems(partners);

  assert.equal(items.length, partners.length);
  partners.forEach((partner, index) => {
    assert.ok(partner.createdAt, partner.id);
    assert.equal(items[index].pubDate, partner.createdAt);
    assert.equal(items[index].link, buildSiteUrl(`/partners/${encodeURIComponent(partner.id)}`));
  });
});

test("mock SEO projection lists the newest partners first like the database query", async () => {
  const repository = new MockPartnerRepository();
  const all = await repository.getPublicPartnerSeoEntries();
  const createdAt = all.map((partner) => partner.createdAt ?? "");
  assert.deepEqual(createdAt, [...createdAt].sort().reverse());

  const limited = await repository.getPublicPartnerSeoEntries({ limit: 1 });
  assert.deepEqual(limited.map((partner) => partner.id), [all[0].id]);
});

test("the partner feed is identical across requests", async () => {
  const first = await buildPartnerRssFeedXml();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await buildPartnerRssFeedXml();

  assert.equal(second, first);
  assert.ok(tagValues(first, "pubDate").length > 0);
});
