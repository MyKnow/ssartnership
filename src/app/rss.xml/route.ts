import { partnerRepository } from "@/lib/repositories";
import { canViewPartnerDetails } from "@/lib/partner-visibility";
import {
  SITE_DESCRIPTION,
  SITE_LEGACY_NAME,
  SITE_NAME,
  SITE_RSS_URL,
} from "@/lib/site";
import { buildRssFeedXml } from "@/lib/rss";
import { buildSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

function toAbsoluteUrl(pathname: string) {
  return buildSiteUrl(pathname);
}

function formatPeriod(start?: string | null, end?: string | null) {
  const startLabel = start?.trim() || "미정";
  const endLabel = end?.trim() || "미정";
  return `${startLabel} ~ ${endLabel}`;
}

async function getFeedItems() {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners({ authenticated: false }),
  ]);
  const categoryMap = new Map(
    categories.map((category) => [category.key, category.label]),
  );
  const publicPartners = partners.filter((partner) =>
    canViewPartnerDetails(partner.visibility, false),
  );
  const now = Date.now();

  return publicPartners.slice(0, 20).map((partner, index) => ({
    title: partner.name,
    link: toAbsoluteUrl(`/partners/${encodeURIComponent(partner.id)}`),
    description: `${SITE_NAME}의 ${categoryMap.get(partner.category) ?? "제휴"} 정보입니다. ${partner.location} · ${formatPeriod(partner.period.start, partner.period.end)}.`,
    pubDate: new Date(now - index * 60_000),
    category: categoryMap.get(partner.category) ?? "제휴",
  }));
}

export async function GET() {
  const items = await getFeedItems();
  const xml = buildRssFeedXml({
    title: `${SITE_NAME}(${SITE_LEGACY_NAME}) | SSAFY(싸피) 공개 제휴 소식`,
    link: buildSiteUrl("/"),
    description: `${SITE_DESCRIPTION} 공개 제휴 소식을 RSS로 받아보세요.`,
    items,
    selfLink: toAbsoluteUrl(SITE_RSS_URL),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
