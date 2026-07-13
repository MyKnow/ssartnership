import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";
import type { AdminPartnerFileBenefitActionType } from "@/lib/admin-partner-file-import";
import {
  PARTNER_REGISTRATION_MODE_OPTIONS,
} from "@/lib/partner-branch-registration";
import {
  PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS,
  PARTNER_REGISTRATION_SERVICE_OPTIONS,
} from "@/lib/partner-registration";
import type { PartnerServiceMode } from "@/lib/partner-service-mode";

export function PartnerRegistrationOptionChip<T extends string>({
  selected,
  label,
  description,
  onClick,
  value,
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: (value: T) => void;
  value: T;
}) {
  return (
    <button
      type="button"
      data-value={value}
      aria-pressed={selected}
      onClick={(event) => {
        onClick(event.currentTarget.dataset.value as T);
      }}
      className={cn(
        "grid min-h-[5.25rem] min-w-0 gap-2 rounded-[1rem] border px-4 py-3 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        selected
          ? "border-primary/35 bg-primary-soft text-primary shadow-flat"
          : "border-border bg-surface-control text-foreground hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{label}</span>
        {selected ? <CheckCircleIcon className="h-4 w-4 shrink-0" /> : null}
      </span>
      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

export function PartnerRegistrationTypeSelector({
  serviceMode,
  benefitActionType,
  onServiceModeChange,
  onBenefitActionTypeChange,
}: {
  serviceMode: PartnerServiceMode;
  benefitActionType: AdminPartnerFileBenefitActionType;
  onServiceModeChange: (value: PartnerServiceMode) => void;
  onBenefitActionTypeChange: (value: AdminPartnerFileBenefitActionType) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">제휴처 유형</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            오프라인 지점인지 온라인 제휴처인지 먼저 고릅니다.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {PARTNER_REGISTRATION_SERVICE_OPTIONS.map((option) => (
            <PartnerRegistrationOptionChip
              key={option.value}
              value={option.value}
              selected={serviceMode === option.value}
              label={option.shortLabel}
              description={option.description}
              onClick={onServiceModeChange}
            />
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">혜택 이용 방식</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            사용자가 혜택을 실제로 받는 방식을 선택합니다.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.map((option) => (
            <PartnerRegistrationOptionChip
              key={option.value}
              value={option.value}
              selected={benefitActionType === option.value}
              label={option.shortLabel}
              description={option.description}
              onClick={onBenefitActionTypeChange}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function PartnerRegistrationModeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">등록 목적</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          전체 신규 등록인지, 기존 제휴처에 혜택이나 지점만 추가하는지 먼저 고릅니다.
        </p>
      </div>
      <div className="grid min-w-0 gap-2 md:grid-cols-3">
        {PARTNER_REGISTRATION_MODE_OPTIONS.map((option) => (
          <PartnerRegistrationOptionChip
            key={option.value}
            value={option.value}
            selected={value === option.value}
            label={option.label}
            description={option.description}
            onClick={onChange}
          />
        ))}
      </div>
    </section>
  );
}
