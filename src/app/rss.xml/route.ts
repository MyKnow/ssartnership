import { partnerRepository } from "@/lib/repositories";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { canViewPartnerDetails, normalizePartnerVisibility } from "@/lib/partner-visibility";
import {
  SITE_DESCRIPTION,
  SITE_LEGACY_NAME,
  SITE_NAME,
  SITE_RSS_URL,
  SITE_URL,
} from "@/lib/site";
import { buildRssFeedXml } from "@/lib/rss";

export const dynamic = "force-dynamic";

type PartnerRow = {
  id: string;
  name: string;
  location: string;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string | null;
  visibility?: string | null;
  categories?: { label?: string | null } | Array<{ label?: string | null }> | null;
};

function extractCategoryLabel(categories: PartnerRow["categories"]) {
  if (!categories) {
    return "제휴";
  }
  if (Array.isArray(categories)) {
    return categories[0]?.label ?? "제휴";
  }
  return categories.label ?? "제휴";
}

function toAbsoluteUrl(pathname: string) {
  return new URL(pathname, SITE_URL).toString();
}

function formatPeriod(start?: string | null, end?: string | null) {
  const startLabel = start?.trim() || "미정";
  const endLabel = end?.trim() || "미정";
  return `${startLabel} ~ ${endLabel}`;
}

async function getFeedItems() {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL &&
    (!!process.env.SUPABASE_ANON_KEY ||
      !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" || !hasSupabaseEnv) {
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

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partners")
    .select("id,name,location,period_start,period_end,created_at,visibility,categories(label)")
    .eq("visibility", normalizePartnerVisibility("public"))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data as PartnerRow[] | null)?.map((partner) => ({
      title: partner.name,
      link: toAbsoluteUrl(`/partners/${encodeURIComponent(partner.id)}`),
      description: `${SITE_NAME}의 ${extractCategoryLabel(partner.categories)} 정보입니다. ${partner.location} · ${formatPeriod(partner.period_start, partner.period_end)}.`,
      pubDate: partner.created_at ?? new Date(),
      category: extractCategoryLabel(partner.categories),
    })) ?? []
  );
}

export async function GET() {
  const items = await getFeedItems();
  const xml = buildRssFeedXml({
    title: `${SITE_NAME}(${SITE_LEGACY_NAME}) | SSAFY(싸피) 공개 제휴 소식`,
    link: SITE_URL,
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
