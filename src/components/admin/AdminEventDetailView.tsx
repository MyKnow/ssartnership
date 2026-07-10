import Image from "next/image";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EventRegistrationForm from "@/components/admin/event-management/EventRegistrationForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import type { EventCampaign } from "@/lib/promotions/catalog";
import type { ManagedEventCampaign } from "@/lib/promotions/events";

type FormAction = (formData: FormData) => Promise<void>;

export type AdminEventDetailViewProps = {
  definition: EventCampaign;
  registration: ManagedEventCampaign | null;
  state: { label: string; className: string };
  targetLabel: string;
  message?: string | null;
  registrationAction: FormAction;
  deleteAction: FormAction;
  rewardContent?: React.ReactNode;
};

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
  registrationAction,
  deleteAction,
  rewardContent,
}: AdminEventDetailViewProps) {
  const isRegistered = registration?.source === "database" && Boolean(registration.id);

  return (
    <div className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="Events"
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
          { label: "규칙", value: `${definition.conditions.length}개`, hint: "보상 조건 수" },
        ]}
        minItemWidth="13rem"
      />
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}

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
                {formatEventDate(registration?.startsAt ?? definition.startsAt)} -{" "}
                {formatEventDate(registration?.endsAt ?? definition.endsAt)}
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
          아직 운영 등록되지 않은 이벤트입니다. 아래에서 공개 링크, 노출 대상, 기간을 입력해 등록할 수 있습니다.
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
          <EventRegistrationForm
            definition={definition}
            registration={registration}
            action={registrationAction}
            submitLabel={isRegistered ? "이벤트 수정" : "이벤트 등록"}
          />
          {isRegistered && registration ? (
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
            <h3 className="text-base font-semibold text-foreground">코드 정의 미리보기</h3>
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

      {rewardContent}
    </div>
  );
}
