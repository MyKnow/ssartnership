import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import CategoryColorBadge from "@/components/ui/CategoryColorBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
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

  return (
    <article className="grid gap-4 rounded-2xl border border-border bg-surface px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getPartnerVisibilityBadgeClass(partner.visibility)}>
              {getPartnerVisibilityLabel(partner.visibility)}
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
            <p className="text-sm text-muted-foreground">{partner.location}</p>
          </div>

          <PartnerAudienceChips appliesTo={partner.applies_to ?? []} />
        </div>

        <div className="flex shrink-0 items-start">
          <Button href={`/admin/partners/${partner.id}`} variant="secondary">
            상세 수정
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
