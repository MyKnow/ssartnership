import Image from "next/image";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import EventRegistrationForm from "@/components/admin/event-management/EventRegistrationForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import {
  createPromotionEventAction,
  deletePromotionEventAction,
  updatePromotionEventAction,
} from "@/app/admin/(protected)/_actions/promotion-actions";
import { getEventPageDefinition } from "@/lib/event-pages";
import { PROMOTION_AUDIENCE_OPTIONS } from "@/lib/promotions/catalog";
import { listManagedEventCampaigns, type ManagedEventCampaign } from "@/lib/promotions/events";

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
  if (!campaign || campaign.source !== "database" || !campaign.id) {
    return {
      label: "등록 필요",
      className: "border-border bg-surface-inset text-muted-foreground",
    };
  }
  if (!campaign.isActive) {
    return {
      label: "비활성",
      className: "border-border bg-surface-inset text-muted-foreground",
    };
  }
  const now = Date.now();
  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  if (Number.isFinite(startsAt) && now < startsAt) {
    return {
      label: "진행 전",
      className: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
    };
  }
  if (Number.isFinite(endsAt) && now > endsAt) {
    return {
      label: "진행 후",
      className: "border-border bg-surface-inset text-muted-foreground",
    };
  }
  return {
    label: "진행 중",
    className: "border-primary/20 bg-primary-soft text-primary",
  };
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
  const isRegistered = registration?.source === "database" && Boolean(registration.id);
  const state = getEventState(registration);
  const message = statusMessage(paramsData.status);
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

        <Card tone="muted" className="grid gap-4">
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
    </AdminShell>
  );
}
