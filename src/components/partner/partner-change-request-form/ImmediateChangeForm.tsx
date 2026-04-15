import FormSection from "@/components/ui/FormSection";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import TokenChipField from "@/components/admin/TokenChipField";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { FieldGroup } from "./FieldGroup";

export function ImmediateChangeForm({
  context,
  saveImmediateAction,
}: {
  context: PartnerChangeRequestContext;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={saveImmediateAction} className="space-y-6">
      <input type="hidden" name="partnerId" value={context.partnerId} />

      <InlineMessage
        title="즉시 반영 항목"
        description="메인 썸네일, 추가 이미지, 예약/문의 링크, 태그는 저장 즉시 반영됩니다."
      />

      <div className="grid gap-4">
        <FormSection
          title="메인 썸네일"
          description="카드 목록에서 보일 1:1 이미지를 수정합니다."
        >
          <PartnerThumbnailField initial={context.thumbnail} className="w-full" />
        </FormSection>

        <FormSection
          title="추가 이미지"
          description="상세 페이지에서 보일 4:3 이미지들을 수정합니다."
        >
          <PartnerGalleryField initial={context.images} className="w-full" />
        </FormSection>

        <FormSection
          title="링크"
          description="예약 링크와 문의 링크를 수정합니다."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup
              label="예약 링크"
              note="http(s), 전화번호, 이메일, 인스타그램 아이디를 입력할 수 있습니다."
            >
              <Input
                name="reservationLink"
                defaultValue={context.reservationLink ?? ""}
                placeholder="예약 링크 또는 연락처"
              />
            </FieldGroup>
            <FieldGroup
              label="문의 링크"
              note="예약 링크와 같은 형식으로 입력할 수 있습니다."
            >
              <Input
                name="inquiryLink"
                defaultValue={context.inquiryLink ?? ""}
                placeholder="문의 링크 또는 연락처"
              />
            </FieldGroup>
          </div>
        </FormSection>

        <FormSection
          title="태그"
          description="검색과 분류에 사용할 태그를 추가합니다."
        >
          <TokenChipField
            name="tags"
            initialValues={context.tags}
            placeholder="Enter를 눌러서 태그를 추가하세요."
            helpText="태그는 줄바꿈으로 구분합니다."
            emptyText="태그를 입력해 주세요."
          />
        </FormSection>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
          즉시 저장
        </SubmitButton>
      </div>
    </form>
  );
}
