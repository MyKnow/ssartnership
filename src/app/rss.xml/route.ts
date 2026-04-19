import { buildPartnerRssFeedXml } from "@/lib/rss/feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await buildPartnerRssFeedXml();

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
