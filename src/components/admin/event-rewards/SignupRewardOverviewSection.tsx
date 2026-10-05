import Button from "@/components/ui/Button";
import SubmitButton from "@/components/ui/SubmitButton";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import {
  createEventRewardDrawAction,
  previewEventRewardDrawAction,
  sendEventRewardWinnerNotificationsAction,
  sendEventRewardWinnerTestNotificationAction,
} from "@/app/admin/(protected)/_actions/promotion-actions";
import type { EventCampaign } from "@/lib/promotions/catalog";
import {
  buildEventRewardComparisonOverview,
  EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT,
  type EventRewardAdminMemberRow,
  type EventRewardAdminOverview,
  type EventRewardDrawPlan,
  type EventRewardStoredDraw,
} from "@/lib/promotions/event-rewards";
import { formatKoreanMonthDayTime } from "@/lib/datetime";
import { formatCount } from "@/lib/number-format";

function formatEventDate(value: string) {
  return formatKoreanMonthDayTime(value) || value;
}

function rewardConditionLabel(
  row: EventRewardAdminMemberRow,
  key: "signup" | "mm" | "push" | "marketing" | "review",
) {
  const condition = row.conditions.find((item) => item.key === key);
  if (key === "review") {
    return `${condition?.currentCount ?? 0}개`;
  }
  return condition?.status === "received" ? "완료" : "-";
}

function RewardStatusPill({
  value,
  muted = false,
}: {
  value: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        value === "완료" && !muted
          ? "border-primary/20 bg-primary-soft text-primary"
          : "border-border/70 bg-surface-inset text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
}

function eventRewardDrawStatusLabel(status: EventRewardStoredDraw["status"]) {
  return {
    draft: "작성 중",
    finalized: "추첨 확정",
    sent: "발송 완료",
    partial_failed: "일부 발송 실패",
    failed: "발송 실패",
  }[status];
}

function eventRewardNotificationStatusLabel(
  status: EventRewardStoredDraw["winners"][number]["notificationStatus"],
) {
  return {
    pending: "발송 대기",
    sent: "발송 완료",
    partial_failed: "일부 실패",
    failed: "발송 실패",
    skipped: "발송 제외",
  }[status];
}

export default function SignupRewardOverviewSection({
  campaign,
  overview,
  draw,
  drawPreview,
  drawPreviewError,
  drawError,
  drawInputWinnerCount,
  drawInputSeed,
  warningMessage,
  canCreate,
  canUpdate,
}: {
  campaign: EventCampaign;
  overview: EventRewardAdminOverview;
  draw: EventRewardStoredDraw | null;
  drawPreview?: EventRewardDrawPlan | null;
  drawPreviewError?: string | null;
  drawError?: string | null;
  drawInputWinnerCount?: string | null;
  drawInputSeed?: string | null;
  warningMessage?: string | null;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const comparison = buildEventRewardComparisonOverview(
    campaign,
    overview.members,
  );
  const conditionStats = [
    { label: "회원가입", value: `${overview.conditionCounts.signup ?? 0}명` },
    { label: "MM 알림", value: `${overview.conditionCounts.mm ?? 0}명` },
    { label: "푸시", value: `${overview.conditionCounts.push ?? 0}명` },
    { label: "마케팅", value: `${overview.conditionCounts.marketing ?? 0}명` },
  ];
  const isRetry =
    draw?.status === "partial_failed" || draw?.status === "failed";
  const testRecipientOptions = overview.members.map((member) => ({
    id: member.id,
    label: `${member.displayName || member.mmUsername} (@${member.mmUsername})`,
    meta: `${member.year}기 · ${member.campus || "-"} · ${formatCount(member.totalTickets)}장`,
  }));

  return (
    <section className="grid min-w-0 gap-5" aria-label="추첨권 현황">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="ui-kicker">추첨권</p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            추첨권 현황
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            이벤트 종료 전 가입자는 회원가입 추첨권 1장을 완료 처리합니다.
          </p>
        </div>
        <Button
          href={`/admin/event/${campaign.slug}/rewards/export`}
          variant="secondary"
        >
          CSV 내보내기
        </Button>
        <Button
          href={`/admin/event/${campaign.slug}/rewards/export?kind=comparison`}
          variant="secondary"
        >
          전후 비교 CSV
        </Button>
      </div>

      <StatsRow
        items={[
          {
            label: "대상 회원",
            value: `${formatCount(overview.memberCount)}명`,
            hint: "전체 회원",
          },
          {
            label: "총 추첨권",
            value: `${formatCount(overview.totalTickets)}장`,
            hint: "현재 조건 기준",
          },
          {
            label: "리뷰 인정",
            value: `${formatCount(overview.reviewCount)}개`,
            hint: "이벤트 기간 visible 리뷰",
          },
          {
            label: "가입 완료",
            value: `${formatCount(overview.conditionCounts.signup ?? 0)}명`,
            hint: "종료 전 가입자",
          },
          {
            label: "확인가능 증가",
            value: `${formatCount(comparison.totalKnownTicketDelta)}장`,
            hint: "before 복원 가능분 기준",
          },
        ]}
        minItemWidth="13rem"
      />
      {warningMessage ? (
        <FormMessage variant="error">{warningMessage}</FormMessage>
      ) : null}

      <Card tone="elevated" className="grid min-w-0 gap-4 overflow-hidden">
        <div className="flex min-w-0 w-full max-w-full flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
          <p className="ui-kicker">추첨</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              가중 추첨
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              추첨권 수만큼 확률을 부여하되 한 회원은 최대 1회만 당첨됩니다.
            </p>
          </div>
          {draw ? (
            <span className="rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              {eventRewardDrawStatusLabel(draw.status)}
            </span>
          ) : null}
        </div>

        {canUpdate ? (
          <form
            action={sendEventRewardWinnerTestNotificationAction}
            className="grid min-w-0 w-full max-w-full gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4"
          >
            <input type="hidden" name="slug" value={campaign.slug} />
            {draw ? (
              <input type="hidden" name="drawId" value={draw.id} />
            ) : null}
            <div>
              <p className="text-sm font-semibold text-foreground">
                테스트 발송
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                앱+MM+푸시 채널로 테스트 안내를 보냅니다.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              수신자
              <select
                name="memberId"
                required
                defaultValue=""
                disabled={testRecipientOptions.length === 0}
                className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground disabled:opacity-60"
              >
                <option value="" disabled>
                  테스트 수신자 선택
                </option>
                {testRecipientOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label} · {member.meta}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end">
              <SubmitButton
                pendingText="발송 중"
                variant="secondary"
                disabled={testRecipientOptions.length === 0}
              >
                테스트 발송
              </SubmitButton>
            </div>
          </form>
        ) : (
          <div className="rounded-[1rem] border border-border/70 bg-surface-inset p-4">
            <p className="text-sm font-semibold text-foreground">
              테스트 발송 권한이 없습니다.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              추첨권 현황은 확인할 수 있지만, 테스트·당첨 안내 발송은 이벤트
              수정 권한이 있는 관리자만 할 수 있습니다.
            </p>
          </div>
        )}

        {draw ? (
          <div className="grid min-w-0 w-full max-w-full gap-4">
            <StatsRow
              items={[
                {
                  label: "당첨자",
                  value: `${formatCount(draw.winners.length)}명`,
                  hint: "확정 결과",
                },
                {
                  label: "후보",
                  value: `${formatCount(draw.candidateCount)}명`,
                  hint: "추첨권 1장 이상",
                },
                {
                  label: "총 추첨권",
                  value: `${formatCount(draw.totalTickets)}장`,
                  hint: "추첨 시점",
                },
                {
                  label: "Seed",
                  value: draw.seed.slice(0, 12),
                  hint: "재현용",
                },
              ]}
              minItemWidth="11rem"
            />
            <div className="hidden overflow-x-auto rounded-[1rem] border border-border/70 md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border bg-surface-inset text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">순위</th>
                    <th className="px-4 py-3">회원</th>
                    <th className="px-4 py-3">기수/캠퍼스</th>
                    <th className="px-4 py-3 text-right">추첨권</th>
                    <th className="px-4 py-3">알림</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {draw.winners.map((winner) => (
                    <tr key={winner.id}>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {winner.rank}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">
                          {winner.displayName || winner.mmUsername}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {winner.mmUsername}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {winner.year}기 · {winner.campus || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatCount(winner.ticketCount)}장
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {eventRewardNotificationStatusLabel(winner.notificationStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid min-w-0 gap-3 md:hidden" aria-label="확정 당첨자 목록">
              {draw.winners.map((winner) => (
                <article
                  key={winner.id}
                  className="grid min-w-0 gap-3 rounded-card border border-border/70 bg-surface-inset p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {winner.rank}위
                      </p>
                      <p className="mt-1 truncate font-semibold text-foreground">
                        {winner.displayName || winner.mmUsername}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {winner.mmUsername}
                      </p>
                    </div>
                    <RewardStatusPill
                      value={eventRewardNotificationStatusLabel(winner.notificationStatus)}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">기수·캠퍼스</dt>
                      <dd className="mt-1 font-medium text-foreground">
                        {winner.year}기 · {winner.campus || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">추첨권</dt>
                      <dd className="mt-1 font-semibold text-foreground">
                        {formatCount(winner.ticketCount)}장
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            {!draw.sentAt && canUpdate ? (
              <form
                action={sendEventRewardWinnerNotificationsAction}
                className="grid min-w-0 w-full max-w-full gap-3 rounded-[1rem] border border-primary/20 bg-primary-soft p-4"
              >
                <input type="hidden" name="slug" value={campaign.slug} />
                <input type="hidden" name="drawId" value={draw.id} />
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {isRetry ? "미도달 당첨자 재발송" : "실제 발송"}
                  </p>
                  <p className="mt-1 text-xs text-primary/80">
                    {isRetry
                      ? "발송 기록을 확인해 이전에 MM·푸시로 안내가 닿지 않은 당첨자에게만 다시 보냅니다."
                      : `당첨자 ${formatCount(draw.winners.length)}명에게 앱+MM+푸시 안내를 보냅니다.`}
                  </p>
                </div>
                <label className="grid gap-2 text-sm font-medium text-primary">
                  확인 문구
                  <input
                    name="confirmationText"
                    required
                    pattern={EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}
                    placeholder={
                      EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT
                    }
                    title={EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}
                    className="h-11 rounded-input border border-primary/20 bg-surface-control px-3 text-sm text-foreground"
                  />
                </label>
                <div className="flex justify-end">
                  <SubmitButton pendingText="발송 중">발송 확인</SubmitButton>
                </div>
              </form>
            ) : draw.sentAt ? (
              <div className="rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                <p className="text-sm font-semibold text-foreground">
                  발송 완료
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatEventDate(draw.sentAt)}
                </p>
              </div>
            ) : (
              <div className="rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                <p className="text-sm font-semibold text-foreground">
                  실제 발송 권한이 없습니다.
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  당첨 결과는 확인할 수 있지만, 당첨 안내 발송은 이벤트 수정
                  권한이 있는 관리자만 할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <form action={createEventRewardDrawAction} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  당첨 인원
                  <input
                    name="winnerCount"
                    type="number"
                    min="1"
                    required
                    defaultValue={
                      drawPreview?.winnerCount ??
                      drawInputWinnerCount ??
                      undefined
                    }
                    className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  구글폼 링크
                  <input
                    name="googleFormUrl"
                    type="url"
                    required
                    placeholder="https://docs.google.com/forms/..."
                    className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Seed 선택 입력
                <input
                  name="seed"
                  defaultValue={drawPreview?.seed ?? drawInputSeed ?? ""}
                  placeholder="비워두면 자동 생성"
                  className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground"
                />
              </label>
              <input type="hidden" name="slug" value={campaign.slug} />
              <div className="flex flex-wrap justify-end gap-2">
                <SubmitButton
                  pendingText="추첨 중"
                  variant="secondary"
                  formAction={previewEventRewardDrawAction}
                  formNoValidate
                >
                  테스트 추첨
                </SubmitButton>
                {canCreate ? <SubmitButton pendingText="확정 중">추첨 확정</SubmitButton> : null}
              </div>
            </form>

            {!canCreate ? (
              <p className="text-sm text-muted-foreground">
                조회 전용 권한에서는 테스트 추첨만 실행할 수 있고, 결과 확정은
                이벤트 생성 권한이 있는 관리자만 할 수 있습니다.
              </p>
            ) : null}
            {drawError ? (
              <FormMessage variant="error">{drawError}</FormMessage>
            ) : null}
            {drawPreviewError ? (
              <FormMessage variant="error">{drawPreviewError}</FormMessage>
            ) : null}
            {drawPreview ? (
              <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      테스트 추첨 결과
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      DB에 저장되지 않는 미리보기입니다. 같은 Seed로 확정하면
                      같은 순서가 재현됩니다.
                    </p>
                  </div>
                  <span className="rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Seed {drawPreview.seed}
                  </span>
                </div>
                <StatsRow
                  items={[
                    {
                      label: "미리보기 당첨자",
                      value: `${formatCount(drawPreview.winners.length)}명`,
                      hint: "저장 안 됨",
                    },
                    {
                      label: "후보",
                      value: `${formatCount(drawPreview.candidateCount)}명`,
                      hint: "추첨권 1장 이상",
                    },
                    {
                      label: "총 추첨권",
                      value: `${formatCount(drawPreview.totalTickets)}장`,
                      hint: "현재 조건 기준",
                    },
                  ]}
                  minItemWidth="11rem"
                />
                <div className="hidden overflow-x-auto rounded-[1rem] border border-border/70 bg-surface md:block">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border bg-surface-inset text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">순위</th>
                        <th className="px-4 py-3">회원</th>
                        <th className="px-4 py-3">기수/캠퍼스</th>
                        <th className="px-4 py-3 text-right">추첨권</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {drawPreview.winners.map((winner) => (
                        <tr key={winner.memberId}>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {winner.rank}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">
                              {winner.displayName || winner.mmUsername}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {winner.mmUsername}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {winner.year}기 · {winner.campus || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            {formatCount(winner.ticketCount)}장
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid min-w-0 gap-3 md:hidden" aria-label="테스트 추첨 당첨자 목록">
                  {drawPreview.winners.map((winner) => (
                    <article
                      key={winner.memberId}
                      className="grid min-w-0 gap-3 rounded-card border border-border/70 bg-surface p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {winner.rank}위
                        </p>
                        <p className="mt-1 truncate font-semibold text-foreground">
                          {winner.displayName || winner.mmUsername}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {winner.mmUsername}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">기수·캠퍼스</dt>
                          <dd className="mt-1 font-medium text-foreground">
                            {winner.year}기 · {winner.campus || "-"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">추첨권</dt>
                          <dd className="mt-1 font-semibold text-foreground">
                            {formatCount(winner.ticketCount)}장
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card tone="muted" className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {conditionStats.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-border/70 bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground"
            >
              {item.label} · {item.value}
            </span>
          ))}
        </div>
      </Card>

      <Card tone="elevated" padding="none" className="min-w-0 overflow-hidden">
        <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-inset text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">회원</th>
                <th className="px-4 py-3">기수/캠퍼스</th>
                <th className="px-4 py-3 text-right">총 추첨권</th>
                <th className="px-4 py-3">signup</th>
                <th className="px-4 py-3">mm</th>
                <th className="px-4 py-3">push</th>
                <th className="px-4 py-3">marketing</th>
                <th className="px-4 py-3">review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {overview.members.map((member) => (
                <tr key={member.id} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">
                      {member.displayName || member.mmUsername}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {member.mmUsername}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {member.year}기 · {member.campus || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-semibold text-foreground">
                    {formatCount(member.totalTickets)}장
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill
                      value={rewardConditionLabel(member, "signup")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill
                      value={rewardConditionLabel(member, "mm")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill
                      value={rewardConditionLabel(member, "push")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill
                      value={rewardConditionLabel(member, "marketing")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill
                      value={rewardConditionLabel(member, "review")}
                      muted
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid min-w-0 gap-3 p-3 md:hidden" aria-label="회원별 추첨권 목록">
          {overview.members.map((member) => (
            <article
              key={member.id}
              className="grid min-w-0 gap-3 rounded-card border border-border/70 bg-surface-inset p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {member.displayName || member.mmUsername}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {member.mmUsername}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {member.year}기 · {member.campus || "-"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <span className="text-sm text-muted-foreground">총 추첨권</span>
                <span className="font-semibold text-foreground">
                  {formatCount(member.totalTickets)}장
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                <div className="grid min-w-0 gap-1">
                  <span className="text-muted-foreground">회원가입</span>
                  <RewardStatusPill value={rewardConditionLabel(member, "signup")} />
                </div>
                <div className="grid min-w-0 gap-1">
                  <span className="text-muted-foreground">MM</span>
                  <RewardStatusPill value={rewardConditionLabel(member, "mm")} />
                </div>
                <div className="grid min-w-0 gap-1">
                  <span className="text-muted-foreground">푸시</span>
                  <RewardStatusPill value={rewardConditionLabel(member, "push")} />
                </div>
                <div className="grid min-w-0 gap-1">
                  <span className="text-muted-foreground">마케팅</span>
                  <RewardStatusPill value={rewardConditionLabel(member, "marketing")} />
                </div>
                <div className="grid min-w-0 gap-1">
                  <span className="text-muted-foreground">리뷰</span>
                  <RewardStatusPill value={rewardConditionLabel(member, "review")} muted />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}
