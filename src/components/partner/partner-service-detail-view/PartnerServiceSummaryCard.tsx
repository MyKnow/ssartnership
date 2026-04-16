import Image from "next/image";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import TrackedAnchor from "@/components/analytics/TrackedAnchor";
import SectionTitle from "@/components/partner/partner-service-detail-view/SectionTitle";
import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";

export default function PartnerServiceSummaryCard({
  context,
  badgeStyle,
  chipStyle,
  thumbnailUrl,
  mapLink,
}: {
  context: PartnerChangeRequestContext;
  badgeStyle?: Record<string, string>;
  chipStyle?: Record<string, string>;
  thumbnailUrl: string;
  mapLink?: string | null;
}) {
  return (
    <Card
      className="order-1 relative overflow-hidden p-6 xl:order-1"
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
            {context.categoryLabel}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {context.periodStart ?? "미정"} ~ {context.periodEnd ?? "미정"}
          </span>
        </div>

        {thumbnailUrl ? (
          <div className="mt-4 w-full max-w-40 overflow-hidden rounded-3xl border border-border bg-surface-muted sm:max-w-48">
            <div className="relative aspect-square w-full">
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 40vw, 192px"
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        ) : null}

        <h1 className="mt-4 text-3xl font-semibold text-foreground">{context.partnerName}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{context.partnerLocation}</span>
          {mapLink ? (
            <TrackedAnchor
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              eventName="partner_map_click"
              targetType="partner"
              targetId={context.partnerId}
              properties={{ source: "partner-portal" }}
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
            <SectionTitle label="이용 조건" />
            <div className="mt-3 flex flex-wrap gap-2">
              {context.currentConditions.map((condition) => (
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
            <SectionTitle label="혜택" />
            <div className="mt-3 flex flex-wrap gap-2">
              {context.currentBenefits.map((benefit) => (
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
            <SectionTitle label="적용 대상" />
            <PartnerAudienceChips appliesTo={context.currentAppliesTo} className="mt-3" />
          </div>

          {context.tags && context.tags.length > 0 ? (
            <div>
              <SectionTitle label="태그" />
              <div className="mt-3 flex flex-wrap gap-2">
                {context.tags.map((tag) => (
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
  );
}
