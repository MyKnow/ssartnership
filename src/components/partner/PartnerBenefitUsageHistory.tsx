import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type { PartnerBenefit } from "@/lib/partner-benefit-items";
import type { PartnerBenefitUsageHistoryPage } from "@/lib/repositories/partner-benefit-usage-repository";

type UsageAction = (formData: FormData) => Promise<void>;

type AdminUsageActions = {
  partnerId: string;
  create: UsageAction;
  update: UsageAction;
  delete: UsageAction;
};

function formatDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(" ", "T");
}

export default function PartnerBenefitUsageHistory({
  benefits,
  selectedBenefit,
  history,
  createHref,
  memberHref,
  adminActions,
}: {
  benefits: readonly (string | PartnerBenefit)[];
  selectedBenefit: string | null;
  history: PartnerBenefitUsageHistoryPage;
  createHref: (input: { benefit?: string | null; page?: number }) => string;
  memberHref?: (memberId: string) => string | null;
  adminActions?: AdminUsageActions;
}) {
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));
  const benefitOptions = benefits.map((benefit) =>
    typeof benefit === "string"
      ? { id: null, title: benefit, maxApplyCount: null }
      : benefit,
  );

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
        {benefitOptions.map((benefit) => (
          <Link
            key={benefit.title}
            href={createHref({ benefit: benefit.title })}
            className={`max-w-64 shrink-0 truncate rounded-full border px-3 py-2 text-sm font-semibold transition ${selectedBenefit === benefit.title ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-control text-foreground hover:border-strong"}`}
            title={benefit.title}
          >
            {benefit.title}
          </Link>
        ))}
      </div>

      {adminActions ? (
        <div className="grid gap-3 rounded-2xl border border-primary/20 bg-primary-soft/40 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">혜택 적용 이력 추가</p>
            <p className="mt-1 text-xs text-muted-foreground">회원 UUID와 혜택을 입력하면 운영자가 수동 적용한 이력으로 기록합니다.</p>
          </div>
          <form action={adminActions.create} className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_5rem_minmax(0,12rem)_auto] lg:items-end">
            <input type="hidden" name="partnerId" value={adminActions.partnerId} />
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              회원 UUID
              <input name="memberId" required className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" placeholder="회원 UUID" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              혜택
              <select name="benefitId" required className="h-10 min-w-0 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
                <option value="">혜택 선택</option>
                {benefitOptions.filter((benefit) => benefit.id).map((benefit) => (
                  <option key={benefit.id} value={benefit.id ?? ""}>{benefit.title}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              횟수
              <input name="useCount" type="number" min={1} defaultValue={1} required className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              적용 시각
              <input name="verifiedAt" type="datetime-local" defaultValue={formatDateTimeInput(new Date().toISOString())} required className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
            </label>
            <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">추가</button>
          </form>
        </div>
      ) : null}

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
            if (!adminActions) {
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
            }

            const selectedBenefitId = usage.benefitId && benefitOptions.some((benefit) => benefit.id === usage.benefitId)
              ? usage.benefitId
              : benefitOptions.find((benefit) => benefit.title === usage.benefitSnapshot)?.id ?? "";
            return (
              <div key={usage.usageId} className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface-inset p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {href ? <Link href={href} className="hover:text-primary hover:underline">{name}</Link> : name}
                    </p>
                    {usage.memberMattermostUsername ? <p className="mt-1 truncate text-xs text-muted-foreground">@{usage.memberMattermostUsername}</p> : null}
                  </div>
                  <Badge variant="neutral">{formatKoreanDateTimeToMinute(usage.verifiedAt)}</Badge>
                </div>
                <form action={adminActions.update} className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_5rem_minmax(0,12rem)_auto] lg:items-end">
                  <input type="hidden" name="partnerId" value={adminActions.partnerId} />
                  <input type="hidden" name="usageId" value={usage.usageId} />
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    회원 UUID
                    <input name="memberId" defaultValue={usage.memberId} required className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    혜택
                    <select name="benefitId" defaultValue={selectedBenefitId} required className="h-10 min-w-0 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
                      <option value="">혜택 선택</option>
                      {benefitOptions.filter((benefit) => benefit.id).map((benefit) => (
                        <option key={benefit.id} value={benefit.id ?? ""}>{benefit.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    횟수
                    <input name="useCount" type="number" min={1} defaultValue={usage.useCount} required className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    적용 시각
                    <input name="verifiedAt" type="datetime-local" defaultValue={formatDateTimeInput(usage.verifiedAt)} required className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
                  </label>
                  <button type="submit" className="h-10 rounded-xl border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft">저장</button>
                </form>
                <form action={adminActions.delete} className="flex justify-end">
                  <input type="hidden" name="partnerId" value={adminActions.partnerId} />
                  <input type="hidden" name="usageId" value={usage.usageId} />
                  <button type="submit" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft">이력 삭제</button>
                </form>
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
