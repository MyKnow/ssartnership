import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import TokenChipField from "@/components/admin/TokenChipField";
import type { PartnerCardFormValues } from "@/components/partner-card-form/types";

export default function PartnerChipSections({
  partner,
}: {
  partner: PartnerCardFormValues;
}) {
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionHeading
            title="이용 조건"
            description="칩으로 분리된 조건을 입력하고, 순서와 내용을 직접 다듬습니다."
          />
          <div className="mt-6">
            <TokenChipField
              name="conditions"
              initialValues={partner.conditions ?? []}
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
              name="benefits"
              initialValues={partner.benefits ?? []}
              placeholder="혜택을 입력하고 Enter"
              helpText="Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."
              emptyText="아직 등록된 혜택이 없습니다."
            />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionHeading
          title="태그"
          description="짧은 키워드를 칩으로 저장하고, 노출 분류를 빠르게 찾을 수 있게 합니다."
        />
        <div className="mt-6">
          <TokenChipField
            name="tags"
            initialValues={partner.tags ?? []}
            placeholder="태그를 입력하고 Enter"
            helpText="짧은 키워드를 칩으로 저장합니다. 줄바꿈으로 여러 개를 한 번에 넣고 위/아래 화살표로 정리할 수 있습니다."
            emptyText="아직 등록된 태그가 없습니다."
          />
        </div>
      </Card>
    </>
  );
}
