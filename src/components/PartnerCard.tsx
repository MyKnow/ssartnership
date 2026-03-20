import type { Partner } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";

const categoryToneMap: Record<string, string> = {
  health: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  restaurant:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
  cafe: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  space: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
};

function getCategoryTone(categoryKey: string) {
  return (
    categoryToneMap[categoryKey] ??
    "bg-surface-muted text-foreground dark:bg-surface-muted dark:text-foreground"
  );
}

export default function PartnerCard({
  partner,
  categoryLabel,
}: {
  partner: Partner;
  categoryLabel: string;
}) {
  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Badge className={getCategoryTone(partner.category)}>
            {categoryLabel}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {partner.period.start} ~ {partner.period.end}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {partner.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {partner.location}
          </p>
        </div>
        <div className="text-sm text-foreground">
          <p className="font-medium text-foreground">연락처</p>
          <p className="mt-1 text-muted-foreground">{partner.contact}</p>
        </div>
        <div className="text-sm text-foreground">
          <p className="font-medium text-foreground">혜택</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {partner.benefits.map((benefit) => (
              <Badge
                key={benefit}
                className="bg-surface-muted text-foreground"
              >
                {benefit}
              </Badge>
            ))}
          </div>
        </div>
        {partner.tags && partner.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {partner.tags.map((tag) => (
              <Chip key={tag}>#{tag}</Chip>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          제휴 문의는 운영진에게 전달
        </p>
        {partner.mapUrl ? (
          <a
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-strong"
            href={partner.mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            지도 보기
          </a>
        ) : null}
      </div>
    </article>
  );
}
