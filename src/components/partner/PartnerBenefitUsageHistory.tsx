import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type { PartnerBenefitUsageHistoryPage } from "@/lib/repositories/partner-benefit-usage-repository";

export default function PartnerBenefitUsageHistory({
  benefits,
  selectedBenefit,
  history,
  createHref,
  memberHref,
}: {
  benefits: readonly string[];
  selectedBenefit: string | null;
  history: PartnerBenefitUsageHistoryPage;
  createHref: (input: { benefit?: string | null; page?: number }) => string;
  memberHref?: (memberId: string) => string | null;
}) {
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));

  return (
    <Card className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="혜택 이용 이력"
          description="PIN 확인 완료 시점의 회원, 횟수, 처리 방식을 혜택별로 확인합니다."
        />
        <Badge variant="neutral">총 {history.total.toLocaleString("ko-KR")}건</Badge>
      </div>

      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="혜택별 이용 이력 필터">
        <Link
          href={createHref({ benefit: null })}
          className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition ${!selectedBenefit ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-control text-foreground hover:border-strong"}`}
        >
          전체
        </Link>
        {benefits.map((benefit) => (
          <Link
            key={benefit}
            href={createHref({ benefit })}
            className={`max-w-64 shrink-0 truncate rounded-full border px-3 py-2 text-sm font-semibold transition ${selectedBenefit === benefit ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-control text-foreground hover:border-strong"}`}
            title={benefit}
          >
            {benefit}
          </Link>
        ))}
      </div>

      {history.items.length === 0 ? (
        <EmptyState
          title="아직 이용 이력이 없습니다."
          description="회원이 인증 카드와 PIN을 확인하면 이곳에 처리 이력이 쌓입니다."
        />
      ) : (
        <div className="grid min-w-0 gap-2">
          {history.items.map((usage) => {
            const name = usage.memberDisplayName ?? usage.memberMattermostUsername ?? "알 수 없는 회원";
            const href = memberHref?.(usage.memberId) ?? null;
            return (
              <div key={usage.usageId} className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface-inset p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {href ? <Link href={href} className="hover:text-primary hover:underline">{name}</Link> : name}
                  </p>
                  {usage.memberMattermostUsername ? <p className="mt-1 truncate text-xs text-muted-foreground">@{usage.memberMattermostUsername}</p> : null}
                </div>
                <p className="line-clamp-2 min-w-0 text-sm text-foreground">{usage.benefitSnapshot}</p>
                <Badge variant="primary">{usage.useCount}회</Badge>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium text-foreground">PIN 확인 완료</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatKoreanDateTimeToMinute(usage.verifiedAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={createHref({ benefit: selectedBenefit, page: Math.max(1, history.page - 1) })}
            aria-disabled={history.page <= 1}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${history.page <= 1 ? "pointer-events-none border-border text-muted-foreground opacity-50" : "border-border text-foreground hover:bg-surface-muted"}`}
          >이전</Link>
          <span className="text-sm text-muted-foreground">{history.page} / {totalPages}</span>
          <Link
            href={createHref({ benefit: selectedBenefit, page: Math.min(totalPages, history.page + 1) })}
            aria-disabled={history.page >= totalPages}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${history.page >= totalPages ? "pointer-events-none border-border text-muted-foreground opacity-50" : "border-border text-foreground hover:bg-surface-muted"}`}
          >다음</Link>
        </div>
      ) : null}
    </Card>
  );
}
