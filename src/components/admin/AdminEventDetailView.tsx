import { Suspense } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminOperationFlow from "@/components/admin/AdminOperationFlow";
import EventRegistrationForm from "@/components/admin/event-management/EventRegistrationForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import Surface from "@/components/ui/Surface";
import type { EventCampaign } from "@/lib/promotions/catalog";
import type { ManagedEventCampaign } from "@/lib/promotions/events";

type FormAction = (formData: FormData) => Promise<void>;

export type AdminEventDetailViewProps = {
  definition: EventCampaign;
  registration: ManagedEventCampaign | null;
  state: { label: string; className: string };
  targetLabel: string;
  message?: string | null;
  errorMessage?: string | null;
  registrationAction: FormAction;
  deleteAction: FormAction;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  rewardContent?: ReactNode;
  rewardContentPromise?: Promise<ReactNode> | null;
};

function RewardContentFallback() {
  return (
    <section className="grid min-w-0 gap-4" aria-label="추첨권 현황">
      <div>
        <p className="ui-kicker">추첨권 운영</p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">
          추첨권 현황
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          이벤트 참여 현황과 추첨 결과를 불러오는 중입니다.
        </p>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="rounded-card border border-border bg-surface-inset px-4 py-5 text-sm text-muted-foreground"
      >
        추첨권 현황을 불러오는 중입니다.
      </div>
    </section>
  );
}

async function DeferredRewardContent({
  rewardContentPromise,
}: {
  rewardContentPromise: Promise<ReactNode>;
}) {
  return await rewardContentPromise;
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

export default function AdminEventDetailView({
  definition,
  registration,
  state,
  targetLabel,
  message,
  errorMessage,
  registrationAction,
  deleteAction,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
  rewardContent,
  rewardContentPromise,
}: AdminEventDetailViewProps) {
  const isRegistered =
    registration?.source === "database" && Boolean(registration.id);

  return (
    <div className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="자동화"
        title={registration ? definition.title : "이벤트 운영 등록"}
        description="공개 이벤트 본문은 코드에서 만들고, 이 화면에서는 공개 링크와 노출 대상, 기간만 관리합니다."
      />
      <StatsRow
        items={[
          {
            label: "상태",
            value: state.label,
            hint: registration ? "운영 등록 기준" : "아직 미등록",
          },
          { label: "대상", value: targetLabel, hint: "현재 노출 대상" },
          {
            label: "규칙",
            value: `${definition.conditions.length}개`,
            hint: "보상 조건 수",
          },
        ]}
        minItemWidth="13rem"
      />
      <AdminOperationFlow
        steps={[
          {
            label: "이벤트 설정",
            description: "기간과 노출 대상을 검토합니다.",
            state: "current",
          },
          {
            label: "노출 확인",
            description: "홈과 공개 링크 연결을 확인합니다.",
            href: "/admin/advertisement",
            state: "upcoming",
          },
          {
            label: "운영 기록",
            description: "저장 결과와 변경 이력을 확인합니다.",
            href: "/admin/logs",
            state: "upcoming",
          },
        ]}
      />
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      <Card
        tone="elevated"
        className="grid min-w-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${state.className}`}
            >
              {state.label}
            </span>
            <span className="max-w-full break-all rounded-full border border-border/70 bg-surface-inset px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              /events/{definition.slug}
            </span>
          </div>
          <h2 className="break-words text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {definition.title}
          </h2>
          <p className="break-words text-sm leading-7 text-muted-foreground">
            {definition.description}
          </p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                공개 기간
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-foreground">
                {formatEventDate(registration?.startsAt ?? definition.startsAt)}{" "}
                - {formatEventDate(registration?.endsAt ?? definition.endsAt)}
              </p>
            </div>
            <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                노출 대상
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-foreground">
                {targetLabel}
              </p>
            </div>
          </div>
        </div>
        <div className="relative aspect-[21/9] min-w-0 overflow-hidden rounded-[1rem] border border-border/70 bg-surface-inset">
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
          아직 운영 등록되지 않은 이벤트입니다. 아래에서 공개 링크, 노출 대상,
          기간을 입력해 등록할 수 있습니다.
        </FormMessage>
      ) : null}

      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)] 2xl:items-start">
        <Card tone="elevated" className="grid min-w-0 gap-5">
          <div>
            <p className="ui-kicker">Registration</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              {registration ? "운영 등록 수정" : "운영 등록"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              공개 링크와 대상, 이벤트 기간만 관리합니다.
            </p>
          </div>
          {isRegistered ? (
            canUpdate ? (
              <EventRegistrationForm
                definition={definition}
                registration={registration}
                action={registrationAction}
                submitLabel="이벤트 수정"
              />
            ) : (
              <Surface level="inset" className="p-4">
                <p className="text-sm font-semibold text-foreground">
                  조회 전용 권한
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  이벤트 상태와 공개 설정은 확인할 수 있지만, 수정은 이벤트 운영
                  권한이 있는 관리자만 할 수 있습니다.
                </p>
              </Surface>
            )
          ) : canCreate ? (
            <EventRegistrationForm
              definition={definition}
              registration={registration}
              action={registrationAction}
              submitLabel="이벤트 등록"
            />
          ) : (
            <Surface level="inset" className="p-4">
              <p className="text-sm font-semibold text-foreground">
                이벤트 등록 권한이 없습니다.
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                공개 이벤트 정의와 운영 조건은 확인할 수 있지만, 운영 등록은
                이벤트 생성 권한이 있는 관리자만 할 수 있습니다.
              </p>
            </Surface>
          )}
          {isRegistered && registration && canDelete ? (
            <form action={deleteAction} className="flex justify-end">
              <input type="hidden" name="id" value={registration.id ?? ""} />
              <input type="hidden" name="slug" value={registration.slug} />
              <Button type="submit" variant="danger">
                이벤트 삭제
              </Button>
            </form>
          ) : null}
        </Card>

        <Card tone="muted" className="grid min-w-0 gap-4 2xl:sticky 2xl:top-24">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              코드 정의 미리보기
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              본문, 조건, 보상 로직은 코드에 고정되어 있습니다.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
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
              <li key={rule} className="break-words">
                - {rule}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {rewardContentPromise ? (
        <Suspense fallback={<RewardContentFallback />}>
          <DeferredRewardContent rewardContentPromise={rewardContentPromise} />
        </Suspense>
      ) : (
        rewardContent
      )}
    </div>
  );
}
