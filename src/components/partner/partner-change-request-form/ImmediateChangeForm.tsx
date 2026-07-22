"use client";

import { type FormEvent, useRef, useState } from "react";
import FormSection from "@/components/ui/FormSection";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import PartnerFormPendingNotice from "@/components/partner/PartnerFormPendingNotice";
import Select from "@/components/ui/Select";
import TokenChipField from "@/components/admin/TokenChipField";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { FieldGroup } from "./FieldGroup";
import FloatingSubmitButton from "./FloatingSubmitButton";
import ImageUploadSubmissionProvider, {
  type ImageUploadSubmissionController,
} from "@/components/media/ImageUploadSubmissionProvider";
import { useImageUploadFormDraft } from "@/components/media/useImageUploadFormDraft";

export function ImmediateChangeForm({
  context,
  saveImmediateAction,
  clearDraftOnSuccess = false,
}: {
  context: PartnerChangeRequestContext;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
  clearDraftOnSuccess?: boolean;
}) {
  const imageUploadControllerRef = useRef<ImageUploadSubmissionController | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const allowUploadedFormSubmitRef = useRef(false);
  const isSubmittingImagesRef = useRef(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [benefitActionType, setBenefitActionType] = useState(
    context.benefitActionType,
  );
  const { saveDraft } = useImageUploadFormDraft({
    formKey: `partner-change-request-${context.partnerId}`,
    formRef,
    imageUploadControllerRef,
    clearOnSuccess: clearDraftOnSuccess,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (allowUploadedFormSubmitRef.current) {
      allowUploadedFormSubmitRef.current = false;
      return;
    }
    const imageUploadController = imageUploadControllerRef.current;
    if (!imageUploadController?.hasPendingUploads()) {
      void saveDraft();
      return;
    }
    event.preventDefault();
    if (isSubmittingImagesRef.current) {
      return;
    }
    const form = event.currentTarget;
    isSubmittingImagesRef.current = true;
    setImageUploadError(null);
    try {
      await saveDraft();
      await imageUploadController.uploadPending();
      await saveDraft();
      allowUploadedFormSubmitRef.current = true;
      form.requestSubmit();
    } catch (error) {
      setImageUploadError(
        error instanceof Error && error.message
          ? error.message
          : "이미지를 업로드하지 못했습니다. 입력한 내용은 유지되므로 다시 시도해 주세요.",
      );
    } finally {
      isSubmittingImagesRef.current = false;
    }
  };

  return (
    <ImageUploadSubmissionProvider
      purpose="partner-change-request"
      actorMode="partner"
      draftKey={`partner-change-request-${context.partnerId}`}
      controllerRef={imageUploadControllerRef}
    >
    <form
      ref={formRef}
      action={saveImmediateAction}
      onSubmit={handleSubmit}
      onChange={() => setImageUploadError(null)}
      className="space-y-5 pb-24 sm:pb-28"
    >
      <input type="hidden" name="companyId" value={context.companyId} />
      <input type="hidden" name="partnerId" value={context.partnerId} />

      <InlineMessage
        title="즉시 반영 항목"
        description="메인 썸네일, 추가 이미지, 혜택 이용/문의 링크, 태그는 저장 즉시 반영됩니다."
      />
      {imageUploadError ? <InlineMessage tone="danger" title="이미지 업로드 실패" description={imageUploadError} /> : null}

      <div className="grid gap-5">
        <PartnerThumbnailField initial={context.thumbnail} className="w-full" />
        <PartnerGalleryField initial={context.images} className="w-full" />

        <FormSection
          title="혜택 이용/문의"
          description="혜택을 실제로 이용하는 방식과 문의 링크를 수정합니다."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup
              label="혜택 이용 방식"
              note="인증 화면 이동, 외부 링크, 현장 제시, 없음 중 하나를 선택합니다."
            >
              <Select
                name="benefitActionType"
                defaultValue={context.benefitActionType}
                onChange={(event) =>
                  setBenefitActionType(
                    event.target.value as typeof context.benefitActionType,
                  )
                }
              >
                <option value="external_link">외부 링크로 이용</option>
                <option value="certification">싸트너십 인증으로 이용</option>
                <option value="onsite">현장 제시로 이용</option>
                <option value="none">별도 행동 없음</option>
              </Select>
            </FieldGroup>
            <FieldGroup
              label="혜택 이용 링크"
              note="외부 링크 방식일 때 입력합니다. http(s), 전화번호, 이메일, 인스타그램 아이디를 입력할 수 있습니다."
            >
              <Input
                name="benefitActionLink"
                defaultValue={context.benefitActionLink ?? context.reservationLink ?? ""}
                placeholder="혜택 이용 링크 또는 연락처"
              />
            </FieldGroup>
            <FieldGroup
              label="제휴 적용 최대 횟수"
              note="싸트너십 인증 방식에서만 적용됩니다. 비워 두면 횟수 제한이 없습니다."
            >
              <Input
                name="benefitUseMaxCount"
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={context.benefitUseMaxCount ?? ""}
                placeholder="제한 없음"
                disabled={benefitActionType !== "certification"}
              />
            </FieldGroup>
            <FieldGroup
              label="문의 링크"
              note="혜택 이용 링크와 같은 형식으로 입력할 수 있습니다."
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

      <PartnerFormPendingNotice message="즉시 반영 항목을 저장하는 중입니다." />

      <FloatingSubmitButton pendingText="저장 중">
        <span className="inline-flex items-center gap-2">
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M17 21v-8H7v8" />
            <path d="M7 3v5h8" />
          </svg>
          즉시 저장
        </span>
      </FloatingSubmitButton>
    </form>
    </ImageUploadSubmissionProvider>
  );
}
