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
import {
  getContactDisplay,
  getMapLink,
  normalizeReservationInquiry,
} from "@/lib/partner-links";
import { isWithinPeriod } from "@/lib/partner-utils";
import ContactCopyRow from "@/components/ContactCopyRow";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import ShareLinkButton from "@/components/ShareLinkButton";

export const dynamic = "force-dynamic";
export const revalidate = 300;

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
  const headerSession = await getHeaderSession();
  const resolvedParams = await params;
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

  const category = categories.find((item) => item.key === partner.category);
  const categoryLabel = category?.label ?? "알 수 없음";
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

  const mapLink = getMapLink(partner.mapUrl, partner.location, partner.name);
  const normalizedLinks = normalizeReservationInquiry(
    partner.reservationLink,
    partner.inquiryLink,
  );
  const reservationDisplay = getContactDisplay(normalizedLinks.reservationLink);
  const inquiryDisplay = getContactDisplay(normalizedLinks.inquiryLink);
  const isActive = isWithinPeriod(partner.period.start, partner.period.end);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
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

            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge
                  className={badgeStyle ? undefined : "bg-surface-muted text-foreground"}
                  style={badgeStyle}
                >
                  {categoryLabel}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {partner.period.start} ~ {partner.period.end}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold text-foreground">
                {partner.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{partner.location}</span>
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

              {!isActive ? (
                <div className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                  현재 제휴 기간이 아닙니다.
                </div>
              ) : null}
            </Card>

            <PartnerImageCarousel
              images={partner.images ?? []}
              name={partner.name}
            />

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card className="p-6">
                <SectionHeading title="혜택" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {partner.benefits.map((benefit) => (
                    <Badge
                      key={benefit}
                      className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                    >
                      {benefit}
                    </Badge>
                  ))}
                </div>

                {partner.conditions && partner.conditions.length > 0 ? (
                  <div className="mt-6">
                    <SectionHeading title="이용 조건" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {partner.conditions.map((condition) => (
                        <Badge
                          key={condition}
                          className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                        >
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {partner.tags && partner.tags.length > 0 ? (
                  <div className="mt-6">
                    <SectionHeading title="태그" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {partner.tags.map((tag) => (
                        <Chip key={tag} style={chipStyle}>
                          #{tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>

              {reservationDisplay ? (
                <Card className="p-6">
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
                <Card className="p-6">
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
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
