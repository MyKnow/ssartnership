import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventLanding from "@/components/events/EventLanding";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import { EVENT_CAMPAIGNS } from "@/lib/promotions/catalog";
import { getManagedEventCampaign } from "@/lib/promotions/events";
import { getEventRewardSummary } from "@/lib/promotions/event-rewards";
import { buildSiteUrl, createCanonicalAlternates } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";

export const revalidate = 300;

export function generateStaticParams() {
  return EVENT_CAMPAIGNS.map((campaign) => ({ slug: campaign.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getManagedEventCampaign(slug);
  if (!campaign) {
    return {};
  }

  return {
    title: `${campaign.title} | ${SITE_NAME}`,
    description: campaign.description,
    alternates: createCanonicalAlternates(`/events/${campaign.slug}`),
    openGraph: {
      title: campaign.title,
      description: campaign.description,
      url: `/events/${campaign.slug}`,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: campaign.heroImageSrc,
          width: 1200,
          height: 514,
          alt: campaign.heroImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: campaign.title,
      description: campaign.description,
      images: [campaign.heroImageSrc],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campaign = await getManagedEventCampaign(slug);
  if (!campaign) {
    notFound();
  }

  const session = await getSignedUserSession();
  const [headerSession, summary] = await Promise.all([
    getHeaderSession(session?.userId ?? undefined),
    getEventRewardSummary({
      campaign,
      memberId: session?.userId ?? null,
    }).catch(() => ({
      authenticated: Boolean(session?.userId),
      totalTickets: 0,
      conditions: campaign.conditions.map((condition) => ({
        key: condition.key,
        status: "missing" as const,
        earnedTickets: 0,
        currentCount: condition.repeatable ? 0 : undefined,
      })),
    })),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: campaign.title,
    description: campaign.description,
    startDate: campaign.startsAt,
    endDate: campaign.endsAt,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: [buildSiteUrl(campaign.heroImageSrc)],
    url: buildSiteUrl(`/events/${campaign.slug}`),
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: buildSiteUrl("/"),
    },
    location: {
      "@type": "VirtualLocation",
      url: buildSiteUrl(`/events/${campaign.slug}`),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <EventLanding campaign={campaign} summary={summary} />
        </Container>
      </main>
    </div>
  );
}
