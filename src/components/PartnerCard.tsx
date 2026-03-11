import type { Partner } from "@/lib/types";

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
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
    <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getCategoryTone(
              partner.category,
            )}`}
          >
            {categoryLabel}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {partner.period.start} ~ {partner.period.end}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {partner.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {partner.location}
          </p>
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            연락처
          </p>
          <p className="mt-1">{partner.contact}</p>
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            혜택
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {partner.benefits.map((benefit) => (
              <span
                key={benefit}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {benefit}
              </span>
            ))}
          </div>
        </div>
        {partner.tags && partner.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {partner.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          제휴 문의는 운영진에게 전달
        </p>
        {partner.mapUrl ? (
          <a
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
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
