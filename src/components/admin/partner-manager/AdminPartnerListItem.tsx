import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import CategoryColorBadge from "@/components/ui/CategoryColorBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
  getPartnerVisibilityState,
} from "@/lib/partner-visibility";
import {
  getPartnerPlaceLinkLabel,
  getPartnerServiceMode,
} from "@/lib/partner-service-mode";
import type { AdminCategory, AdminPartner } from "@/components/admin/partner-manager/types";

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminPartnerListItem({
  partner,
  category,
}: {
  partner: AdminPartner;
  category: AdminCategory | null;
}) {
  const metrics = partner.metrics;
  const visibilityState = getPartnerVisibilityState(
    partner.visibility,
    partner.period_start,
    partner.period_end,
  );
  const serviceMode = getPartnerServiceMode(partner.location);
  const isOnlineService = serviceMode === "online";
  const placeLinkLabel = getPartnerPlaceLinkLabel(serviceMode);

  return (
    <article className="grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-border bg-surface px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getPartnerVisibilityBadgeClass(visibilityState)}>
              {getPartnerVisibilityLabel(visibilityState)}
            </Badge>
            <CategoryColorBadge
              label={category?.label ?? "미분류"}
              color={category?.color}
            />
            <Badge>{partner.company?.name ?? "회사 미연결"}</Badge>
          </div>

          <div className="grid gap-1">
            <Link
              href={`/admin/partners/${partner.id}`}
              prefetch={false}
              className="inline-flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary"
            >
              <span className="truncate">{partner.name}</span>
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
              {!isOnlineService ? <p>{partner.location}</p> : null}
              {isOnlineService && partner.map_url ? (
                <a
                  href={partner.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-foreground hover:border-strong"
                  aria-label={placeLinkLabel}
                  title={placeLinkLabel}
                >
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 17 17 7" />
                    <path d="M8 7h9v9" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>

          <PartnerAudienceChips appliesTo={partner.applies_to ?? []} />
        </div>

        <div className="flex shrink-0 items-start">
          <Button href={`/admin/partners/${partner.id}`} variant="secondary">
            상세 수정
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
        <MetricPill label="즐겨찾기" value={metrics?.favoriteCount ?? 0} />
        <MetricPill label="PV" value={metrics?.detailViews ?? 0} />
        <MetricPill label="UV" value={metrics?.detailUv ?? 0} />
        <MetricPill label="CTA" value={metrics?.totalClicks ?? 0} />
        <MetricPill label="예약" value={metrics?.reservationClicks ?? 0} />
        <MetricPill label="문의" value={metrics?.inquiryClicks ?? 0} />
        <MetricPill label="리뷰" value={metrics?.reviewCount ?? 0} />
      </div>
    </article>
  );
}
