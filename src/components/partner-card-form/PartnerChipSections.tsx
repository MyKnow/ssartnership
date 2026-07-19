import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import TokenChipField from "@/components/admin/TokenChipField";
import { cn } from "@/lib/cn";
import type { PartnerCardDraftSnapshot } from "@/lib/partner-card-form/draft";
import {
  COUPON_ONLY_BENEFIT_TEXT,
  COUPON_ONLY_CONDITION_TEXT,
  removeCouponOnlyDefaults,
  type BenefitListingMode,
} from "@/lib/partner-coupon-only";
import type { PartnerCardFormValues } from "@/components/partner-card-form/types";

export default function PartnerChipSections({
  partner,
  benefitListingMode,
  onBenefitListingModeChange,
  restoredDraftValues,
  draftRestoreVersion = 0,
}: {
  partner: PartnerCardFormValues;
  benefitListingMode: BenefitListingMode;
  onBenefitListingModeChange: (value: BenefitListingMode) => void;
  restoredDraftValues?: PartnerCardDraftSnapshot | null;
  draftRestoreVersion?: number;
}) {
  const editableConditions = restoredDraftValues
    ? restoredDraftValues.conditions
    : removeCouponOnlyDefaults(partner.conditions);
  const editableBenefits = restoredDraftValues
    ? restoredDraftValues.benefits
    : removeCouponOnlyDefaults(partner.benefits);
  const tags = restoredDraftValues?.tags ?? partner.tags ?? [];

  return (
    <>
      <Card className="overflow-hidden">
        <SectionHeading
          title="혜택 구성"
          description="상시 노출할 혜택이 있는지, 소모성 쿠폰만 운영하는지 선택합니다."
        />
        <div className="mt-6 grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: "always_on",
                  label: "상시 혜택 있음",
                  description: "상세 카드에 노출할 혜택과 조건을 직접 입력합니다.",
                },
                {
                  value: "coupon_only",
                  label: "소모성 쿠폰만 제공",
                  description: "쿠폰별 수량, 기간, 조건을 별도로 운영합니다.",
                },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={benefitListingMode === option.value}
                onClick={() => onBenefitListingModeChange(option.value)}
                className={cn(
                  "grid min-h-20 min-w-0 gap-1 rounded-[1rem] border px-4 py-3 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  benefitListingMode === option.value
                    ? "border-primary/35 bg-primary-soft text-primary"
                    : "border-border bg-surface-control text-foreground hover:border-strong hover:bg-surface-elevated",
                )}
              >
                <span className="truncate text-sm font-semibold">{option.label}</span>
                <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            ))}
          </div>

          {benefitListingMode === "coupon_only" ? (
            <div className="grid min-w-0 gap-3 rounded-[1rem] border border-primary/15 bg-primary-soft p-4 text-primary">
              <input type="hidden" name="conditions" value={COUPON_ONLY_CONDITION_TEXT} />
              <input type="hidden" name="benefits" value={COUPON_ONLY_BENEFIT_TEXT} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  쿠폰 전용 제휴처로 저장
                </p>
                <p className="mt-1 text-ko-pretty text-sm leading-6">
                  상시 혜택 없이 저장하고, 쿠폰 관리에서 쿠폰명, 수량, 사용 기간, 1인당 사용 횟수를 설정합니다.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <div className="grid min-w-0 gap-1 rounded-[0.85rem] border border-primary/15 bg-surface/80 px-3 py-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    저장 혜택
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {COUPON_ONLY_BENEFIT_TEXT}
                  </span>
                </div>
                <div className="grid min-w-0 gap-1 rounded-[0.85rem] border border-primary/15 bg-surface/80 px-3 py-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    저장 조건
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {COUPON_ONLY_CONDITION_TEXT}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {benefitListingMode === "always_on" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <SectionHeading
              title="이용 조건"
              description="칩으로 분리된 조건을 입력하고, 순서와 내용을 직접 다듬습니다."
            />
            <div className="mt-6">
              <TokenChipField
                key={`conditions-${draftRestoreVersion}`}
                name="conditions"
                initialValues={editableConditions}
                placeholder="조건을 입력하고 Enter"
                helpText="Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."
                emptyText="아직 등록된 이용 조건이 없습니다."
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeading
              title="혜택"
              description="칩 단위로 혜택을 저장하고, 필요한 문구를 언제든 수정합니다."
            />
            <div className="mt-6">
              <TokenChipField
                key={`benefits-${draftRestoreVersion}`}
                name="benefits"
                initialValues={editableBenefits}
                placeholder="혜택을 입력하고 Enter"
                helpText="Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."
                emptyText="아직 등록된 혜택이 없습니다."
              />
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <SectionHeading
          title="태그"
          description="짧은 키워드를 칩으로 저장하고, 노출 분류를 빠르게 찾을 수 있게 합니다."
        />
        <div className="mt-6">
          <TokenChipField
            key={`tags-${draftRestoreVersion}`}
            name="tags"
            initialValues={tags}
            placeholder="태그를 입력하고 Enter"
            helpText="짧은 키워드를 칩으로 저장합니다. 줄바꿈으로 여러 개를 한 번에 넣고 위/아래 화살표로 정리할 수 있습니다."
            emptyText="아직 등록된 태그가 없습니다."
          />
        </div>
      </Card>
    </>
  );
}
