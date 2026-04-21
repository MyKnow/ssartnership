import Image from "next/image";
import AdminShell from "@/components/admin/AdminShell";
import PromotionCarousel from "@/components/promotions/PromotionCarousel";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import ShellHeader from "@/components/ui/ShellHeader";
import Textarea from "@/components/ui/Textarea";
import {
  createPromotionEventAction,
  updatePromotionEventAction,
} from "@/app/admin/(protected)/_actions/promotion-actions";
import {
  EVENT_CAMPAIGNS,
  type EventCampaign,
  type EventCondition,
  type EventConditionKey,
} from "@/lib/promotions/catalog";
import {
  getHomePromotionSlides,
  listManagedEventCampaigns,
  type ManagedEventCampaign,
} from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

const conditionLabels: Record<EventConditionKey, string> = {
  signup: "회원가입",
  mm: "Mattermost",
  push: "푸시",
  marketing: "마케팅/이벤트",
  review: "리뷰",
};

const defaultCampaign = EVENT_CAMPAIGNS[0];

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date).replace(" ", "T");
}

function rulesToText(rules: string[]) {
  return rules.join("\n");
}

function getCondition(campaign: EventCampaign, key: EventConditionKey) {
  return (
    campaign.conditions.find((condition) => condition.key === key) ??
    defaultCampaign.conditions.find((condition) => condition.key === key)!
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}

function ConditionFields({
  condition,
}: {
  condition: EventCondition;
}) {
  const prefix = `condition_${condition.key}`;
  return (
    <div className="grid gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {conditionLabels[condition.key]}
        </p>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            name={`${prefix}_repeatable`}
            defaultChecked={condition.repeatable}
            className="h-4 w-4 accent-primary"
          />
          반복 지급
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_7rem]">
        <FieldLabel label="조건명">
          <Input name={`${prefix}_title`} defaultValue={condition.title} required />
        </FieldLabel>
        <FieldLabel label="추첨권">
          <Input
            name={`${prefix}_tickets`}
            type="number"
            min={0}
            defaultValue={condition.tickets}
            required
          />
        </FieldLabel>
      </div>
      <FieldLabel label="설명">
        <Textarea
          name={`${prefix}_description`}
          defaultValue={condition.description}
          required
        />
      </FieldLabel>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
        <FieldLabel label="CTA 링크">
          <Input name={`${prefix}_ctaHref`} defaultValue={condition.ctaHref} required />
        </FieldLabel>
        <FieldLabel label="CTA 라벨">
          <Input name={`${prefix}_ctaLabel`} defaultValue={condition.ctaLabel} required />
        </FieldLabel>
      </div>
    </div>
  );
}

function EventForm({
  campaign,
  mode,
}: {
  campaign: EventCampaign | ManagedEventCampaign;
  mode: "create" | "update";
}) {
  const action = mode === "create" ? createPromotionEventAction : updatePromotionEventAction;
  const managed = campaign as ManagedEventCampaign;
  const canUpdate = mode === "create" || Boolean(managed.id);

  return (
    <form action={action} className="grid gap-5">
      {mode === "update" && managed.id ? (
        <input type="hidden" name="id" value={managed.id} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
        <FieldLabel label="Slug">
          <Input name="slug" defaultValue={campaign.slug} required />
        </FieldLabel>
        <FieldLabel label="짧은 제목">
          <Input name="shortTitle" defaultValue={campaign.shortTitle} required />
        </FieldLabel>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-foreground sm:justify-end">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={mode === "create" ? true : managed.isActive}
            className="h-4 w-4 accent-primary"
          />
          활성
        </label>
      </div>
      <FieldLabel label="이벤트 제목">
        <Input name="title" defaultValue={campaign.title} required />
      </FieldLabel>
      <FieldLabel label="설명">
        <Textarea name="description" defaultValue={campaign.description} required />
      </FieldLabel>
      <FieldLabel label="기간 안내 문구">
        <Input name="periodLabel" defaultValue={campaign.periodLabel} required />
      </FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="시작 시각">
          <Input
            name="startsAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(campaign.startsAt)}
            required
          />
        </FieldLabel>
        <FieldLabel label="종료 시각">
          <Input
            name="endsAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(campaign.endsAt)}
            required
          />
        </FieldLabel>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="대표 이미지 경로">
          <Input name="heroImageSrc" defaultValue={campaign.heroImageSrc} required />
        </FieldLabel>
        <FieldLabel label="대표 이미지 대체 텍스트">
          <Input name="heroImageAlt" defaultValue={campaign.heroImageAlt} required />
        </FieldLabel>
      </div>
      <section className="grid gap-3" aria-label="이벤트 조건 편집">
        <div>
          <h3 className="text-base font-semibold text-foreground">참여 조건</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 이벤트 페이지가 이해하는 5개 조건을 수정합니다.
          </p>
        </div>
        {(["signup", "mm", "push", "marketing", "review"] as EventConditionKey[]).map(
          (key) => (
            <ConditionFields key={key} condition={getCondition(campaign, key)} />
          ),
        )}
      </section>
      <FieldLabel label="유의사항">
        <Textarea
          name="rules"
          defaultValue={rulesToText(campaign.rules)}
          rows={5}
          required
        />
      </FieldLabel>
      {!canUpdate ? (
        <FormMessage variant="error">
          DB migration이 적용되지 않아 catalog fallback 이벤트는 직접 수정할 수 없습니다.
        </FormMessage>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={!canUpdate}>
          {mode === "create" ? "이벤트 추가" : "이벤트 수정"}
        </Button>
      </div>
    </form>
  );
}

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [promotionSlides, campaigns] = await Promise.all([
    getHomePromotionSlides(),
    listManagedEventCampaigns({ includeInactive: true }),
  ]);
  const statusMessage =
    params.status === "created"
      ? "이벤트를 추가했습니다."
      : params.status === "updated"
        ? "이벤트를 수정했습니다."
        : null;

  return (
    <AdminShell title="광고와 이벤트 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Promotions"
          title="광고와 이벤트 관리"
          description="홈 캐러셀 광고 카드와 이벤트 랜딩을 관리합니다."
        />
        {statusMessage ? <FormMessage variant="info">{statusMessage}</FormMessage> : null}

        <Card tone="elevated" className="grid gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ui-kicker">Preview</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                홈 캐러셀 미리보기
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                저장된 활성 이벤트가 홈 캐러셀 카드로 함께 노출됩니다.
              </p>
            </div>
            <Button href="/" variant="secondary" className="w-full sm:w-auto">
              홈에서 보기
            </Button>
          </div>
          <PromotionCarousel slides={promotionSlides} className="mt-0" />
        </Card>

        <Card tone="elevated" className="grid gap-5">
          <div>
            <p className="ui-kicker">Create</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              이벤트 추가
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              기본 추첨권 이벤트 값을 복사해 새 이벤트를 만듭니다.
            </p>
          </div>
          <EventForm
            mode="create"
            campaign={{
              ...defaultCampaign,
              slug: "",
              title: "",
              shortTitle: "",
            }}
          />
        </Card>

        <section className="grid gap-4" aria-label="이벤트 수정 목록">
          <div className="px-1">
            <p className="ui-kicker">Events</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              이벤트 {campaigns.length}개
            </h2>
          </div>

          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={`${campaign.source}:${campaign.slug}`} padding="md" className="grid gap-5">
                <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_auto] lg:items-center">
                  <div className="relative aspect-[21/9] overflow-hidden rounded-[1rem] border border-border/70 bg-surface-inset">
                    <Image
                      src={campaign.heroImageSrc}
                      alt={campaign.heroImageAlt}
                      fill
                      sizes="(min-width: 1024px) 288px, calc(100vw - 32px)"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      /events/{campaign.slug}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">
                      {campaign.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {campaign.description}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-muted-foreground">
                      {campaign.source === "database" ? "DB 저장" : "Catalog fallback"} ·{" "}
                      {campaign.isActive ? "활성" : "비활성"}
                    </p>
                  </div>
                  <Button
                    href={`/events/${campaign.slug}`}
                    variant="secondary"
                    className="w-full lg:w-auto"
                  >
                    랜딩 보기
                  </Button>
                </div>
                <details className="rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    수정 폼 열기
                  </summary>
                  <div className="mt-5">
                    <EventForm mode="update" campaign={campaign} />
                  </div>
                </details>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
