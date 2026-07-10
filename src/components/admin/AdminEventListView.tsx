import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";

export type AdminEventListItem = {
  slug: string;
  title: string;
  description: string;
  pagePath: string;
  stateLabel: string;
  stateClassName: string;
  periodLabel: string;
  targetLabel: string;
  conditionLabels: string[];
  isRegistered: boolean;
};

export type AdminEventListSection = {
  bucket: string;
  items: AdminEventListItem[];
};

export type AdminEventListViewProps = {
  sections: AdminEventListSection[];
  statusMessage?: string | null;
};

function EventPill({
  children,
  className = "border-border/70 bg-surface-inset text-muted-foreground",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function EventCard({ item }: { item: AdminEventListItem }) {
  return (
    <article className="grid min-w-0 gap-4 rounded-panel border border-border bg-surface p-5 shadow-flat">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <EventPill className={item.stateClassName}>{item.stateLabel}</EventPill>
        <EventPill>/{item.slug}</EventPill>
        <EventPill>{item.pagePath}</EventPill>
      </div>

      <div className="grid min-w-0 gap-2">
        <h3 className="break-words text-xl font-semibold tracking-[-0.02em] text-foreground">
          {item.title}
        </h3>
        <p className="break-words text-sm leading-6 text-muted-foreground">
          {item.description}
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            공개 기간
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-foreground">
            {item.periodLabel}
          </p>
        </div>
        <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            노출 대상
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-foreground">
            {item.targetLabel}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        {item.conditionLabels.map((condition) => (
          <EventPill key={condition}>{condition}</EventPill>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/event/${item.slug}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-strong hover:bg-surface-elevated"
        >
          {item.isRegistered ? "운영 설정" : "등록하기"}
        </Link>
        <Link
          href={`/events/${item.slug}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface-muted px-4 text-sm font-semibold text-foreground transition hover:border-strong hover:bg-surface-elevated"
        >
          랜딩 보기
        </Link>
      </div>
    </article>
  );
}

export default function AdminEventListView({
  sections,
  statusMessage,
}: AdminEventListViewProps) {
  const count = (bucket: string) =>
    sections.find((section) => section.bucket === bucket)?.items.length ?? 0;

  return (
    <div className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="Events"
        title="이벤트 관리"
        description="코드로 만든 이벤트 페이지를 등록하고, 공개 전·중·후 상태와 노출 대상을 확인합니다."
      />
      <StatsRow
        items={[
          { label: "진행 전", value: `${count("진행 전")}개`, hint: "오픈 대기" },
          { label: "진행 중", value: `${count("진행 중")}개`, hint: "현재 노출 중" },
          { label: "진행 후", value: `${count("진행 후")}개`, hint: "종료 후 보관" },
          {
            label: "미등록/비활성",
            value: `${count("등록 필요") + count("비활성")}개`,
            hint: "등록 필요 + 비활성",
          },
        ]}
        minItemWidth="13rem"
      />
      {statusMessage ? <FormMessage variant="info">{statusMessage}</FormMessage> : null}

      {sections.map((section) => (
        <section
          key={section.bucket}
          className="grid min-w-0 gap-4"
          aria-label={`${section.bucket} 이벤트`}
        >
          <div className="flex min-w-0 items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="ui-kicker">Events</p>
              <h2 className="mt-2 break-words text-xl font-semibold text-foreground">
                {section.bucket}
              </h2>
            </div>
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">
              {section.items.length}개
            </span>
          </div>

          {section.items.length > 0 ? (
            <div className="grid min-w-0 gap-5">
              {section.items.map((item) => (
                <EventCard key={item.slug} item={item} />
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
  );
}
