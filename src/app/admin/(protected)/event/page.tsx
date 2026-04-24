import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import { listEventPageDefinitions } from "@/lib/event-pages";
import { PROMOTION_AUDIENCE_OPTIONS } from "@/lib/promotions/catalog";
import { listManagedEventCampaigns, type ManagedEventCampaign } from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

function statusMessage(status?: string) {
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

function EventPill({
  children,
  className = "border-border/70 bg-surface-inset text-muted-foreground",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function EventCard({
  definition,
  registration,
}: {
  definition: ReturnType<typeof listEventPageDefinitions>[number];
  registration: ManagedEventCampaign | null;
}) {
  const isRegistered = registration?.source === "database" && Boolean(registration.id);
  const state = getEventState(registration);
  const periodStarts = formatEventDate(registration?.startsAt ?? definition.startsAt);
  const periodEnds = formatEventDate(registration?.endsAt ?? definition.endsAt);
  const targetLabel =
    registration?.targetAudiences?.map(
      (audience) => PROMOTION_AUDIENCE_OPTIONS.find((option) => option.key === audience)?.label ?? audience,
    ).join(" · ") ?? "전체";

  return (
    <article className="grid gap-4 rounded-panel border border-border bg-surface p-5 shadow-flat">
      <div className="flex flex-wrap items-center gap-2">
        <EventPill className={state.className}>{state.label}</EventPill>
        <EventPill>/{definition.slug}</EventPill>
        <EventPill>
          {registration?.pagePath ?? `/events/${definition.slug}`}
        </EventPill>
      </div>

      <div className="grid gap-2">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          {definition.title}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{definition.description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            공개 기간
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {periodStarts} - {periodEnds}
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

      <div className="flex flex-wrap gap-2">
        {definition.conditions.map((condition) => (
          <EventPill key={condition.key}>
            {condition.title} · {condition.tickets}장
          </EventPill>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/event/${definition.slug}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-strong hover:bg-surface-elevated"
        >
          {isRegistered ? "운영 설정" : "등록하기"}
        </Link>
        <Link
          href={`/events/${definition.slug}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface-muted px-4 text-sm font-semibold text-foreground transition hover:border-strong hover:bg-surface-elevated"
        >
          랜딩 보기
        </Link>
      </div>
    </article>
  );
}

export default async function AdminEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const definitions = listEventPageDefinitions();
  const registrations = await listManagedEventCampaigns({ includeInactive: true });
  const registrationMap = new Map(registrations.map((campaign) => [campaign.slug, campaign]));

  const sections = (["진행 전", "진행 중", "진행 후", "비활성", "등록 필요"] as const).map(
    (bucket) => ({
      bucket,
      items: definitions.filter((definition) => {
        const registration = registrationMap.get(definition.slug) ?? null;
        if (!registration) {
          return bucket === "등록 필요";
        }
        return getEventState(registration).label === bucket;
      }),
    }),
  );

  return (
    <AdminShell title="이벤트 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Events"
          title="이벤트 관리"
          description="코드로 만든 이벤트 페이지를 등록하고, 공개 전·중·후 상태와 노출 대상을 확인합니다."
        />
        {statusMessage(params.status) ? (
          <FormMessage variant="info">{statusMessage(params.status)}</FormMessage>
        ) : null}

        {sections.map((section) => (
          <section key={section.bucket} className="grid gap-4" aria-label={`${section.bucket} 이벤트`}>
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="ui-kicker">Events</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">
                  {section.bucket}
                </h2>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {section.items.length}개
              </span>
            </div>

            {section.items.length > 0 ? (
              <div className="grid gap-5">
                {section.items.map((definition) => (
                  <EventCard
                    key={definition.slug}
                    definition={definition}
                    registration={registrationMap.get(definition.slug) ?? null}
                  />
                ))}
              </div>
            ) : (
              <Card tone="muted" className="text-sm text-muted-foreground">
                해당 상태의 이벤트가 없습니다.
              </Card>
            )}
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
