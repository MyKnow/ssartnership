import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { ManagedEventCampaign } from "@/lib/promotions/events";
import {
  DEFAULT_PROMOTION_AUDIENCES,
  PROMOTION_AUDIENCE_OPTIONS,
  type EventCampaign,
  type PromotionAudience,
} from "@/lib/promotions/catalog";

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

function getDefaultAudiences(registration?: ManagedEventCampaign | null): PromotionAudience[] {
  return registration?.targetAudiences?.length
    ? registration.targetAudiences
    : [...DEFAULT_PROMOTION_AUDIENCES];
}

export default function EventRegistrationForm({
  definition,
  registration,
  action,
  submitLabel,
}: {
  definition: EventCampaign;
  registration?: ManagedEventCampaign | null;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const isRegistered = Boolean(registration?.id);
  const startsAt = toDateTimeLocal(registration?.startsAt ?? definition.startsAt);
  const endsAt = toDateTimeLocal(registration?.endsAt ?? definition.endsAt);
  const audiences = getDefaultAudiences(registration);
  const pagePath = registration?.pagePath ?? `/events/${definition.slug}`;

  return (
    <form action={action} className="grid gap-5">
      {isRegistered && registration?.id ? <input type="hidden" name="id" value={registration.id} /> : null}
      <input type="hidden" name="slug" value={definition.slug} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_18rem]">
        <FieldLabel label="공개 링크">
          <Input defaultValue={pagePath} readOnly />
        </FieldLabel>
        <FieldLabel label="공개 상태">
          <label className="flex h-11 items-center gap-2 rounded-[var(--radius-input)] border border-border bg-surface px-4 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={registration ? registration.isActive : true}
              className="h-4 w-4 accent-primary"
            />
            공개
          </label>
        </FieldLabel>
      </div>

      <section className="grid gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">노출 대상</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            어떤 회원에게 보일지 선택합니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROMOTION_AUDIENCE_OPTIONS.map((option) => (
            <label
              key={option.key}
              className="flex items-start gap-3 rounded-[1rem] border border-border/70 bg-surface px-4 py-3 text-sm font-medium text-foreground"
            >
              <input
                type="checkbox"
                name="targetAudiences"
                value={option.key}
                defaultChecked={audiences.includes(option.key)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="grid gap-0.5">
                <span>{option.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="공개 시작">
          <Input name="startsAt" type="datetime-local" defaultValue={startsAt} required />
        </FieldLabel>
        <FieldLabel label="공개 종료">
          <Input name="endsAt" type="datetime-local" defaultValue={endsAt} required />
        </FieldLabel>
      </div>

      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
