import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import TrackedAnchor from "@/components/analytics/TrackedAnchor";
import { partnerRepository } from "@/lib/repositories";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import Card from "@/components/ui/Card";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import {
  getContactDisplay,
  getMapLink,
  normalizeReservationInquiry,
} from "@/lib/partner-links";
import { isWithinPeriod } from "@/lib/partner-utils";
import ContactCopyRow from "@/components/ContactCopyRow";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import ShareLinkButton from "@/components/ShareLinkButton";
import {
  SITE_KEYWORDS,
  SITE_LEGACY_NAME,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const rawId = resolvedParams?.id
    ? decodeURIComponent(resolvedParams.id).trim()
    : "";

  if (!rawId) {
    return {
      title: `제휴 정보 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const [categories, partner] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartnerById(rawId, {
      authenticated: false,
    }),
  ]);

  if (!partner) {
    return {
      title: `제휴 정보 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const categoryLabel =
    categories.find((item) => item.key === partner.category)?.label ?? "제휴";
  const canonicalPath = `/partners/${encodeURIComponent(rawId)}`;
  const title = `${partner.name} | SSAFY(싸피) ${categoryLabel} 제휴 | ${SITE_NAME}(${SITE_LEGACY_NAME})`;
  const description = `싸트너십(SSARTNERSHIP)에서 ${partner.name}을 확인하세요. SSAFY(싸피) 서울 캠퍼스 ${categoryLabel} 제휴이며, ${partner.location}에서 이용 가능한 혜택과 제휴 기간을 확인할 수 있습니다.`;

  return {
    title,
    description,
    keywords: [
      partner.name,
      categoryLabel,
      "싸트너십",
      "SSARTNERSHIP",
      "SSAFY",
      "싸피",
      "싸피 제휴",
      "SSAFY 제휴",
      "서울 캠퍼스 제휴",
      ...SITE_KEYWORDS,
    ],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "article",
      images: [
        {
          url: "/icon-512.png",
          width: 512,
          height: 512,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/icon-512.png"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [headerSession, resolvedParams] = await Promise.all([
    getHeaderSession(),
    params,
  ]);
  const rawId = resolvedParams?.id
    ? decodeURIComponent(resolvedParams.id).trim()
    : "";
  if (!rawId) {
    redirect("/");
  }
  const [categories, partnerById] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartnerById(rawId, {
      authenticated: Boolean(headerSession?.userId),
    }),
  ]);

  const partner = partnerById ?? null;

  if (!partner) {
    redirect("/");
  }

  const isActive = isWithinPeriod(partner.period.start, partner.period.end);
  const category = categories.find((item) => item.key === partner.category);
  const categoryLabel = category?.label ?? "알 수 없음";
  const viewPartner = partner;
  const badgeStyle = category?.color
    ? {
        backgroundColor: withAlpha(category.color, "1f"),
        color: category.color,
      }
    : undefined;
  const chipStyle = category?.color
    ? {
        backgroundColor: withAlpha(category.color, "14"),
        borderColor: withAlpha(category.color, "55"),
        color: category.color,
    }
    : undefined;

  const mapLink = getMapLink(viewPartner.mapUrl, viewPartner.location, viewPartner.name);
  const normalizedLinks = isActive
    ? normalizeReservationInquiry(
        viewPartner.reservationLink,
        viewPartner.inquiryLink,
      )
    : { reservationLink: "", inquiryLink: "" };
  const reservationDisplay = isActive
    ? getContactDisplay(normalizedLinks.reservationLink)
    : null;
  const inquiryDisplay = isActive
    ? getContactDisplay(normalizedLinks.inquiryLink)
    : null;
  const contactCount = [reservationDisplay, inquiryDisplay].filter(Boolean).length;
  const partnerUrl = `${SITE_URL}/partners/${encodeURIComponent(partner.id)}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "홈",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: partner.name,
        item: partnerUrl,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(breadcrumbJsonLd),
            }}
          />
          <AnalyticsEventOnMount
            eventName="partner_detail_view"
            targetType="partner"
            targetId={partner.id}
            properties={{
              categoryKey: partner.category,
              isActive,
            }}
            dedupeKey={`partner-detail:${partner.id}`}
          />
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-foreground hover:border-strong"
                aria-label="목록으로 돌아가기"
              >
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <ShareLinkButton targetType="partner" targetId={partner.id} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
              <Card
                className="order-2 relative overflow-hidden p-6 xl:order-1"
                data-partner-detail-summary
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.08),_transparent_42%)]"
                />
                <div className="relative flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge
                      className={badgeStyle ? undefined : "bg-surface-muted text-foreground"}
                      style={badgeStyle}
                    >
                      {categoryLabel}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      {viewPartner.period.start} ~ {viewPartner.period.end}
                    </span>
                  </div>

                  <h1 className="mt-4 text-3xl font-semibold text-foreground">
                    {viewPartner.name}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{viewPartner.location}</span>
                    {mapLink ? (
                      <TrackedAnchor
                        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
                        href={mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        eventName="partner_map_click"
                        targetType="partner"
                        targetId={partner.id}
                        properties={{ source: "detail" }}
                        aria-label="지도 보기"
                        title="지도 보기"
                      >
                        <svg
                          width={16}
                          height={16}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
                          <path d="M9 3v15" />
                          <path d="M15 6v15" />
                        </svg>
                      </TrackedAnchor>
                    ) : null}
                  </div>

          <div className="mt-6 grid gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                이용 조건
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {viewPartner.conditions.map((condition) => (
                  <Badge
                    key={condition}
                    className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                  >
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                혜택
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {viewPartner.benefits.map((benefit) => (
                  <Badge
                    key={benefit}
                    className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                  >
                    {benefit}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                적용 대상
              </p>
              <PartnerAudienceChips appliesTo={viewPartner.appliesTo} className="mt-3" />
            </div>

            {viewPartner.tags && viewPartner.tags.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  태그
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {viewPartner.tags.map((tag) => (
                    <Chip key={tag} style={chipStyle}>
                      #{tag}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
                </div>
              </Card>

              <PartnerImageCarousel
                key={`${partner.id}:${(viewPartner.images ?? []).join("|")}`}
                className="order-1 xl:order-2"
                images={viewPartner.images ?? []}
                name={viewPartner.name}
                matchHeightSelector="[data-partner-detail-summary]"
              />
            </div>

            {isActive ? (
              <div className={`grid gap-4 ${contactCount > 1 ? "xl:grid-cols-2" : ""}`}>
                {reservationDisplay ? (
                  <Card className="w-full p-4 sm:p-5">
                    <SectionHeading title="예약" />
                    <ContactCopyRow
                      href={reservationDisplay.href}
                      label={reservationDisplay.label}
                      rawValue={normalizedLinks.reservationLink ?? ""}
                      eventName="reservation_click"
                      targetType="partner"
                      targetId={partner.id}
                    />
                  </Card>
                ) : null}

                {inquiryDisplay ? (
                  <Card className="w-full p-4 sm:p-5">
                    <SectionHeading title="문의" />
                    <ContactCopyRow
                      href={inquiryDisplay.href}
                      label={inquiryDisplay.label}
                      rawValue={normalizedLinks.inquiryLink ?? ""}
                      eventName="inquiry_click"
                      targetType="partner"
                      targetId={partner.id}
                    />
                  </Card>
                ) : null}

                {contactCount === 0 ? (
                  <Card className="w-full p-4 sm:p-5">
                    <SectionHeading title="예약/문의" />
                    <div className="mt-4 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                      현재 등록된 예약/문의 정보가 없습니다.
                    </div>
                  </Card>
                ) : null}
              </div>
            ) : (
              <Card className="w-full p-4 sm:p-5">
                <SectionHeading title="예약/문의" />
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
                  현재 제휴기간이 아니므로, 예약/문의를 할 수 없습니다.
                </div>
              </Card>
            )}
          </div>
        </Container>
      </main>
    </div>
  );
}
