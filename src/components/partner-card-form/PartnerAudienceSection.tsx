import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import { PARTNER_AUDIENCE_OPTIONS } from "@/lib/partner-audience";
import type { PartnerCardFormField } from "@/components/partner-card-form/types";

export default function PartnerAudienceSection({
  appliesToValue,
  setAppliesToValue,
  fieldErrors,
}: {
  appliesToValue: string[];
  setAppliesToValue: (updater: (current: string[]) => string[]) => void;
  fieldErrors?: Partial<Record<PartnerCardFormField, string>>;
}) {
  return (
    <Card className="overflow-hidden">
      <SectionHeading
        title="적용 대상"
        description="상세 페이지에서 보이는 적용 대상 칩을 기준으로 노출 범위를 관리합니다."
      />
      <div className="mt-6 grid gap-4">
        <div
          className={cn(
            "grid gap-2 rounded-[1.25rem] border border-border p-3 sm:grid-cols-3",
            fieldErrors?.appliesTo ? "border-danger/40 ring-2 ring-danger/15" : null,
          )}
        >
          {PARTNER_AUDIENCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm font-medium text-foreground"
            >
              <input
                type="checkbox"
                name="appliesTo"
                value={option.value}
                checked={appliesToValue.includes(option.value)}
                onChange={(event) => {
                  setAppliesToValue((current) =>
                    event.target.checked
                      ? Array.from(new Set([...current, option.value]))
                      : current.filter((item) => item !== option.value),
                  );
                }}
                aria-invalid={Boolean(fieldErrors?.appliesTo) || undefined}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {fieldErrors?.appliesTo ? (
          <span className="text-xs font-medium text-danger">{fieldErrors.appliesTo}</span>
        ) : null}
      </div>
    </Card>
  );
}
