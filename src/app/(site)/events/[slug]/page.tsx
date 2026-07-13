import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventPageView from "@/components/events/EventPageView";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import { getEventPageDefinition, listEventPageDefinitions } from "@/lib/event-pages";
import {
  getManagedEventCampaign,
  isPromotionCampaignVisible,
} from "@/lib/promotions/events";
import { getEventRewardSummary } from "@/lib/promotions/event-rewards";
import { buildSiteUrl, createCanonicalAlternates } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";

export const revalidate = 300;

export function generateStaticParams() {
  return listEventPageDefinitions().map((campaign) => ({ slug: campaign.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const definition = getEventPageDefinition(slug);
  if (!definition) {
    return {};
  }
  const registration = await getManagedEventCampaign(slug);
  const campaign = registration ?? definition;
  const canonicalPath = registration?.pagePath ?? `/events/${campaign.slug}`;
  const visible = registration ? isPromotionCampaignVisible(registration) : false;

  return {
    title: `${campaign.title} | ${SITE_NAME}`,
    description: campaign.description,
    alternates: createCanonicalAlternates(canonicalPath),
    openGraph: {
      title: campaign.title,
      description: campaign.description,
      url: canonicalPath,
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
      index: visible,
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
  const definition = getEventPageDefinition(slug);
  if (!definition) {
    notFound();
  }
  const registration = await getManagedEventCampaign(slug);
  const campaign = registration ?? definition;
  if (!registration || !isPromotionCampaignVisible(registration)) {
    notFound();
  }
  const canonicalPath = registration?.pagePath ?? `/events/${campaign.slug}`;

  const session = await getSignedUserSession();
  const rewardsEnabled = Boolean(
    registration?.source === "database" &&
      registration.id &&
      isPromotionCampaignVisible(registration),
  );
  const [headerSession, summary] = await Promise.all([
    getHeaderSession(session?.userId ?? undefined),
    rewardsEnabled
      ? getEventRewardSummary({
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
        }))
      : Promise.resolve({
          authenticated: Boolean(session?.userId),
          totalTickets: 0,
          conditions: campaign.conditions.map((condition) => ({
            key: condition.key,
            status: "missing" as const,
            earnedTickets: 0,
            currentCount: condition.repeatable ? 0 : undefined,
          })),
        }),
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
    url: buildSiteUrl(canonicalPath),
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: buildSiteUrl("/"),
    },
    location: {
      "@type": "VirtualLocation",
      url: buildSiteUrl(canonicalPath),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <EventPageView
        campaign={campaign}
        summary={summary}
        showHeroImage={campaign.slug !== "signup-reward"}
        showRegistrationNotice={
          registration?.source !== "database" || !registration.isActive
        }
        structuredData={jsonLd}
      />
    </div>
  );
}
