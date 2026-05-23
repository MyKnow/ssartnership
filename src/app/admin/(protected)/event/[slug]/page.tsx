import Image from "next/image";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import EventRegistrationForm from "@/components/admin/event-management/EventRegistrationForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import {
  createEventRewardDrawAction,
  createPromotionEventAction,
  deletePromotionEventAction,
  sendEventRewardWinnerTestNotificationAction,
  sendEventRewardWinnerNotificationsAction,
  updatePromotionEventAction,
} from "@/app/admin/(protected)/_actions/promotion-actions";
import { getEventPageDefinition } from "@/lib/event-pages";
import { PROMOTION_AUDIENCE_OPTIONS, type EventCampaign } from "@/lib/promotions/catalog";
import {
  buildEventRewardAdminOverview,
  buildEventRewardComparisonOverview,
  EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT,
  getEventRewardAdminOverview,
  getLatestEventRewardDrawWithWinners,
  type EventRewardAdminMemberRow,
  type EventRewardAdminOverview,
  type EventRewardStoredDraw,
} from "@/lib/promotions/event-rewards";
import {
  getPromotionCampaignState,
  listManagedEventCampaigns,
  type ManagedEventCampaign,
} from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

function statusMessage(status?: string) {
  if (status === "created") {
    return "이벤트를 등록했습니다.";
  }
  if (status === "updated") {
    return "이벤트를 수정했습니다.";
  }
  if (status === "deleted") {
    return "이벤트를 삭제했습니다.";
  }
  if (status === "draw-created") {
    return "추첨 결과를 확정했습니다.";
  }
  if (status === "winner-sent") {
    return "당첨 안내를 발송했습니다.";
  }
  if (status === "winner-test-sent") {
    return "당첨 안내 테스트를 발송했습니다.";
  }
  return null;
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getEventState(campaign: ManagedEventCampaign | null) {
  const state = getPromotionCampaignState(campaign);
  const className =
    state.key === "active"
      ? "border-primary bg-primary text-primary-foreground"
      : state.key === "upcoming"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200"
        : "border-border bg-surface-inset text-muted-foreground";
  return { label: state.label, className };
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

function SignupRewardOverviewSection({
  campaign,
  overview,
  draw,
  warningMessage,
}: {
  campaign: EventCampaign;
  overview: EventRewardAdminOverview;
  draw: EventRewardStoredDraw | null;
  warningMessage?: string | null;
}) {
  const comparison = buildEventRewardComparisonOverview(campaign, overview.members);
  const conditionStats = [
    { label: "회원가입", value: `${overview.conditionCounts.signup ?? 0}명` },
    { label: "MM 알림", value: `${overview.conditionCounts.mm ?? 0}명` },
    { label: "푸시", value: `${overview.conditionCounts.push ?? 0}명` },
    { label: "마케팅", value: `${overview.conditionCounts.marketing ?? 0}명` },
  ];
  const testRecipientOptions = overview.members.map((member) => ({
    id: member.id,
    label: `${member.displayName || member.mmUsername} (@${member.mmUsername})`,
    meta: `${member.year}기 · ${member.campus || "-"} · ${member.totalTickets.toLocaleString()}장`,
  }));

  return (
    <section className="grid gap-5" aria-label="추첨권 현황">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ui-kicker">Rewards</p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            추첨권 현황
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            이벤트 종료 전 가입자는 회원가입 추첨권 1장을 완료 처리합니다.
          </p>
        </div>
        <Button href="/admin/event/signup-reward/rewards/export" variant="secondary">
          CSV 내보내기
        </Button>
        <Button
          href="/admin/event/signup-reward/rewards/export?kind=comparison"
          variant="secondary"
        >
          전후 비교 CSV
        </Button>
      </div>

      <StatsRow
        items={[
          { label: "대상 회원", value: `${overview.memberCount.toLocaleString()}명`, hint: "전체 회원" },
          { label: "총 추첨권", value: `${overview.totalTickets.toLocaleString()}장`, hint: "현재 조건 기준" },
          { label: "리뷰 인정", value: `${overview.reviewCount.toLocaleString()}개`, hint: "이벤트 기간 visible 리뷰" },
          { label: "가입 완료", value: `${(overview.conditionCounts.signup ?? 0).toLocaleString()}명`, hint: "종료 전 가입자" },
          { label: "확인가능 증가", value: `${comparison.totalKnownTicketDelta.toLocaleString()}장`, hint: "before 복원 가능분 기준" },
        ]}
        minItemWidth="13rem"
      />
      {warningMessage ? (
        <FormMessage variant="error">{warningMessage}</FormMessage>
      ) : null}

      <Card tone="elevated" className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="ui-kicker">Draw</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              가중 추첨
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              추첨권 수만큼 확률을 부여하되 한 회원은 최대 1회만 당첨됩니다.
            </p>
          </div>
          {draw ? (
            <span className="rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              {draw.status}
            </span>
          ) : null}
        </div>

        {draw ? (
          <div className="grid gap-4">
            <StatsRow
              items={[
                { label: "당첨자", value: `${draw.winners.length.toLocaleString()}명`, hint: "확정 결과" },
                { label: "후보", value: `${draw.candidateCount.toLocaleString()}명`, hint: "추첨권 1장 이상" },
                { label: "총 추첨권", value: `${draw.totalTickets.toLocaleString()}장`, hint: "추첨 시점" },
                { label: "Seed", value: draw.seed.slice(0, 12), hint: "재현용" },
              ]}
              minItemWidth="11rem"
            />
            <div className="overflow-x-auto rounded-[1rem] border border-border/70">
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
                        {winner.ticketCount.toLocaleString()}장
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {winner.notificationStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <form
                action={sendEventRewardWinnerTestNotificationAction}
                className="grid gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4"
              >
                <input type="hidden" name="slug" value="signup-reward" />
                <input type="hidden" name="drawId" value={draw.id} />
                <div>
                  <p className="text-sm font-semibold text-foreground">테스트 발송</p>
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
                    className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground"
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
                  <Button type="submit" variant="secondary">
                    테스트 발송
                  </Button>
                </div>
              </form>

              {!draw.sentAt ? (
                <form
                  action={sendEventRewardWinnerNotificationsAction}
                  className="grid gap-3 rounded-[1rem] border border-primary/20 bg-primary-soft p-4"
                >
                  <input type="hidden" name="slug" value="signup-reward" />
                  <input type="hidden" name="drawId" value={draw.id} />
                  <div>
                    <p className="text-sm font-semibold text-primary">실제 발송</p>
                    <p className="mt-1 text-xs text-primary/80">
                      당첨자 {draw.winners.length.toLocaleString()}명에게 앱+MM+푸시 안내를 보냅니다.
                    </p>
                  </div>
                  <label className="grid gap-2 text-sm font-medium text-primary">
                    확인 문구
                    <input
                      name="confirmationText"
                      required
                      pattern={EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}
                      placeholder={EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}
                      title={EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}
                      className="h-11 rounded-input border border-primary/20 bg-surface-control px-3 text-sm text-foreground"
                    />
                  </label>
                  <div className="flex justify-end">
                    <Button type="submit">발송 확인</Button>
                  </div>
                </form>
              ) : (
                <div className="rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                  <p className="text-sm font-semibold text-foreground">발송 완료</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventDate(draw.sentAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form action={createEventRewardDrawAction} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                당첨 인원
                <input
                  name="winnerCount"
                  type="number"
                  min="1"
                  required
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
                placeholder="비워두면 자동 생성"
                className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground"
              />
            </label>
            <input type="hidden" name="slug" value="signup-reward" />
            <div className="flex justify-end">
              <Button type="submit">추첨 확정</Button>
            </div>
          </form>
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

      <Card tone="elevated" padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
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
                    {member.totalTickets.toLocaleString()}장
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill value={rewardConditionLabel(member, "signup")} />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill value={rewardConditionLabel(member, "mm")} />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill value={rewardConditionLabel(member, "push")} />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill value={rewardConditionLabel(member, "marketing")} />
                  </td>
                  <td className="px-4 py-3">
                    <RewardStatusPill value={rewardConditionLabel(member, "review")} muted />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

export default async function AdminEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const paramsData = (await searchParams) ?? {};
  const definition = getEventPageDefinition(slug);
  if (!definition) {
    notFound();
  }

  const campaigns = await listManagedEventCampaigns({ includeInactive: true });
  const registration = campaigns.find((campaign) => campaign.slug === slug) ?? null;
  const campaign = registration ?? definition;
  const isRegistered = registration?.source === "database" && Boolean(registration.id);
  const state = getEventState(isRegistered ? registration : null);
  const message = statusMessage(paramsData.status);
  let rewardOverview: EventRewardAdminOverview | null = null;
  let rewardDraw: EventRewardStoredDraw | null = null;
  let rewardWarningMessage: string | null = null;
  if (slug === "signup-reward") {
    try {
      [rewardOverview, rewardDraw] = await Promise.all([
        getEventRewardAdminOverview(campaign),
        getLatestEventRewardDrawWithWinners(slug),
      ]);
    } catch (error) {
      console.error("[admin-event] reward overview query failed", error);
      rewardOverview = buildEventRewardAdminOverview(campaign, []);
      rewardWarningMessage =
        "추첨권 현황 데이터를 불러오지 못했습니다. Supabase 연결과 이벤트 보상 테이블 상태를 확인해 주세요.";
    }
  }
  const targetLabel =
    registration?.targetAudiences?.map(
      (audience) => PROMOTION_AUDIENCE_OPTIONS.find((option) => option.key === audience)?.label ?? audience,
    ).join(" · ") ?? "전체";

  return (
    <AdminShell
      title={registration ? definition.title : "이벤트 운영 등록"}
      backHref="/admin/event"
      backLabel="이벤트 목록"
    >
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Events"
          title={registration ? definition.title : "이벤트 운영 등록"}
          description="공개 이벤트 본문은 코드에서 만들고, 이 화면에서는 공개 링크와 노출 대상, 기간만 관리합니다."
        />
        <StatsRow
          items={[
            { label: "상태", value: state.label, hint: registration ? "운영 등록 기준" : "아직 미등록" },
            { label: "대상", value: `${targetLabel}`, hint: "현재 노출 대상" },
            { label: "규칙", value: `${definition.conditions.length}개`, hint: "보상 조건 수" },
          ]}
          minItemWidth="13rem"
        />
        {message ? (
          <FormMessage variant="info">{message}</FormMessage>
        ) : null}

        <Card tone="elevated" className="grid gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${state.className}`}>
                {state.label}
              </span>
              <span className="rounded-full border border-border/70 bg-surface-inset px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                /events/{definition.slug}
              </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {definition.title}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">{definition.description}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  공개 기간
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatEventDate(registration?.startsAt ?? definition.startsAt)} -{" "}
                  {formatEventDate(registration?.endsAt ?? definition.endsAt)}
                </p>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  노출 대상
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {targetLabel}
                </p>
              </div>
            </div>
          </div>
          <div className="relative aspect-[21/9] overflow-hidden rounded-[1rem] border border-border/70 bg-surface-inset">
            <Image
              src={definition.heroImageSrc}
              alt={definition.heroImageAlt}
              fill
              sizes="(min-width: 1024px) 384px, calc(100vw - 32px)"
              className="object-cover"
            />
          </div>
        </Card>

        {!isRegistered ? (
          <FormMessage variant="info">
            아직 운영 등록되지 않은 이벤트입니다. 아래에서 공개 링크, 노출 대상, 기간을 입력해 등록할 수 있습니다.
          </FormMessage>
        ) : null}

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <Card tone="elevated" className="grid gap-5">
            <div>
              <p className="ui-kicker">Registration</p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                {registration ? "운영 등록 수정" : "운영 등록"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                공개 링크와 대상, 이벤트 기간만 관리합니다.
              </p>
            </div>
            <EventRegistrationForm
              definition={definition}
              registration={registration}
              action={isRegistered ? updatePromotionEventAction : createPromotionEventAction}
              submitLabel={isRegistered ? "이벤트 수정" : "이벤트 등록"}
            />
            {isRegistered && registration ? (
              <form action={deletePromotionEventAction} className="flex justify-end">
                <input type="hidden" name="id" value={registration.id ?? ""} />
                <input type="hidden" name="slug" value={registration.slug} />
                <Button type="submit" variant="danger">
                  이벤트 삭제
                </Button>
              </form>
            ) : null}
          </Card>

          <Card tone="muted" className="grid gap-4 2xl:sticky 2xl:top-24">
            <div>
              <h3 className="text-base font-semibold text-foreground">코드 정의 미리보기</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                본문, 조건, 보상 로직은 코드에 고정되어 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {definition.conditions.map((condition) => (
                <span
                  key={condition.key}
                  className="rounded-full border border-border/70 bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {condition.title} · {condition.tickets}장
                </span>
              ))}
            </div>
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              {definition.rules.map((rule) => (
                <li key={rule}>- {rule}</li>
              ))}
            </ul>
          </Card>
        </div>

        {rewardOverview ? (
          <SignupRewardOverviewSection
            campaign={campaign}
            overview={rewardOverview}
            draw={rewardDraw}
            warningMessage={rewardWarningMessage}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
