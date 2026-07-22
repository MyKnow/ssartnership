import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import TokenChipField from "@/components/admin/TokenChipField";
import PartnerBenefitItemsField from "@/components/partner-card-form/PartnerBenefitItemsField";
import { normalizePartnerBenefitItems } from "@/lib/partner-benefit-items";
import type { PartnerCardDraftSnapshot } from "@/lib/partner-card-form/draft";
import { removeCouponOnlyDefaults } from "@/lib/partner-coupon-only";
import type { PartnerCardFormValues } from "@/components/partner-card-form/types";

export default function PartnerChipSections({
  partner,
  restoredDraftValues,
  draftRestoreVersion = 0,
}: {
  partner: PartnerCardFormValues;
  restoredDraftValues?: PartnerCardDraftSnapshot | null;
  draftRestoreVersion?: number;
}) {
  const editableConditions = restoredDraftValues
    ? restoredDraftValues.conditions
    : removeCouponOnlyDefaults(partner.conditions);
  const editableBenefits = restoredDraftValues
    ? normalizePartnerBenefitItems(restoredDraftValues.benefits.map((title, index) => ({ id: `draft-benefit-${index + 1}`, title })))
    : partner.benefitItems?.length
      ? partner.benefitItems
      : normalizePartnerBenefitItems(removeCouponOnlyDefaults(partner.benefits).map((title, index) => ({ id: `legacy-benefit-${index + 1}`, title })));
  const tags = restoredDraftValues?.tags ?? partner.tags ?? [];

  return (
    <>
      <Card className="overflow-hidden">
        <SectionHeading
          title="혜택 구성"
          description="제휴처에 항상 노출할 혜택과 이용 조건을 입력합니다. 쿠폰은 제휴처 상세에서 별도로 운영합니다."
        />
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <SectionHeading
              title="이용 조건"
              description="쿠폰과 별도로 제휴처 이용 시 지켜야 할 조건을 입력합니다."
            />
            <div className="mt-6">
              <TokenChipField
                key={`conditions-${draftRestoreVersion}`}
                name="conditions"
                initialValues={editableConditions}
                placeholder="조건을 입력하고 Enter"
                helpText="Enter로 조건을 추가합니다."
                emptyText="아직 등록된 이용 조건이 없습니다."
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeading
              title="혜택"
              description="상세 페이지에 항상 노출할 기본 혜택을 입력합니다."
            />
            <div className="mt-6">
              <PartnerBenefitItemsField
                key={`benefit-items-${draftRestoreVersion}`}
                initialItems={editableBenefits}
                draftRestoreVersion={draftRestoreVersion}
              />
            </div>
          </Card>
        </div>
      </Card>

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
