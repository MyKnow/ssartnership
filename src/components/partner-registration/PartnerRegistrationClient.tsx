"use client";

import { type FormEvent, useRef, useState } from "react";
import {
  ClipboardDocumentListIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import TokenChipField from "@/components/admin/TokenChipField";
import PartnerBranchListEditor from "@/components/partner-branches/PartnerBranchListEditor";
import PartnerRegistrationStepProgress from "@/components/partner-registration/PartnerRegistrationStepProgress";
import PartnerRegistrationBulkDisclosure, {
  type PartnerRegistrationExcelAction,
} from "@/components/partner-registration/PartnerRegistrationBulkDisclosure";
import PartnerRegistrationContactStep from "@/components/partner-registration/PartnerRegistrationContactStep";
import PartnerRegistrationMediaStep from "@/components/partner-registration/PartnerRegistrationMediaStep";
import {
  PartnerRegistrationField as Field,
  PartnerRegistrationInput as FormInput,
  PartnerRegistrationTextarea as FormTextarea,
} from "@/components/partner-registration/PartnerRegistrationFields";
import {
  PartnerRegistrationModeSelector,
  PartnerRegistrationOptionChip,
  PartnerRegistrationTypeSelector,
} from "@/components/partner-registration/PartnerRegistrationSelectors";
import {
  type PartnerRegistrationBrandProfile,
  type PartnerRegistrationWebAction,
  usePartnerRegistrationController,
} from "@/components/partner-registration/usePartnerRegistrationController";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import ImageUploadSubmissionProvider, {
  type ImageUploadSubmissionController,
} from "@/components/media/ImageUploadSubmissionProvider";
import { useImageUploadFormDraft } from "@/components/media/useImageUploadFormDraft";
import { useImageUploadSubmissionId } from "@/components/media/useImageUploadSubmissionId";
import {
  COUPON_ONLY_BENEFIT_TEXT,
  COUPON_ONLY_CONDITION_TEXT,
} from "@/lib/partner-coupon-only";
import {
  partnerRegistrationInitialFormState,
  type PartnerRegistrationActionState,
  type PartnerRegistrationFormState,
} from "@/lib/partner-registration";
import type { AdminPartnerFileCategory } from "@/lib/admin-partner-file-import";

function splitInitialChipValues(value?: string) {
  return value
    ? value
        .split(/[\n|]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export default function PartnerRegistrationClient({
  categories,
  webAction,
  excelAction,
  initialWebState,
  initialValues,
  brandProfiles = [],
  showExcelTab = true,
  lockCompanyName = false,
  titleBadge = "관리자 검토 후 등록",
  submitLabel = "신청 접수",
  submitPendingLabel = "접수 중",
  hiddenFields,
}: {
  categories: AdminPartnerFileCategory[];
  webAction: PartnerRegistrationWebAction;
  excelAction?: PartnerRegistrationExcelAction;
  initialWebState?: PartnerRegistrationActionState;
  initialValues?: Partial<PartnerRegistrationFormState>;
  brandProfiles?: PartnerRegistrationBrandProfile[];
  showExcelTab?: boolean;
  lockCompanyName?: boolean;
  titleBadge?: string;
  submitLabel?: string;
  submitPendingLabel?: string;
  hiddenFields?: Record<string, string>;
}) {
  const {
    activeStep,
    registrationMode,
    serviceMode,
    branchEntryMode,
    benefitActionType,
    benefitListingMode,
    branchRows,
    webState,
    webFormAction,
    fieldErrors,
    formRef,
    effectiveBenefitActionType,
    branchListText,
    inferredBranchScopeType,
    currentStepIndex,
    isLastStep,
    setRegistrationMode,
    setBranchEntryMode,
    setBranchRows,
    clearClientFieldErrors,
    registerFieldRef,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    applyBrandProfile,
    handleWebSubmit,
    handleServiceModeChange,
    handleBenefitActionTypeChange,
    handleBenefitListingModeChange,
  } = usePartnerRegistrationController({
    webAction,
    initialWebState,
    initialValues,
    brandProfiles,
  });
  const imageUploadControllerRef = useRef<ImageUploadSubmissionController | null>(null);
  const allowUploadedFormSubmitRef = useRef(false);
  const isSubmittingImagesRef = useRef(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const draftKey = hiddenFields?.companyId
    ? `partner-registration-company-${hiddenFields.companyId}`
    : "partner-registration-public";
  const submissionId = useImageUploadSubmissionId(draftKey);
  const { saveDraft } = useImageUploadFormDraft({
    formKey: draftKey,
    formRef,
    imageUploadControllerRef,
    clearOnSuccess: webState.status === "success",
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (allowUploadedFormSubmitRef.current) {
      allowUploadedFormSubmitRef.current = false;
      return;
    }
    if (!handleWebSubmit(event)) {
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

  const typeSelector = (
    <PartnerRegistrationTypeSelector
      serviceMode={serviceMode}
      benefitActionType={benefitActionType}
      onServiceModeChange={handleServiceModeChange}
      onBenefitActionTypeChange={handleBenefitActionTypeChange}
    />
  );

  return (
    <ImageUploadSubmissionProvider
      purpose="partner-registration"
      draftKey={draftKey}
      controllerRef={imageUploadControllerRef}
    >
      <div className="grid min-w-0 gap-5">
        <Card tone="default" padding="md">
          <div className="grid min-w-0 gap-5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <SectionHeading
                eyebrow="Step Form"
                title="단계별 등록"
                description="제휴처 정보부터 적용 지점까지 단계별로 입력해 검토를 요청합니다."
                className="min-w-0"
                headingLevel="h2"
              />
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                <ClipboardDocumentListIcon className="h-4 w-4" />
                {titleBadge}
              </div>
            </div>

            {webState.message ? (
              <FormMessage
                variant={webState.status === "success" ? "info" : "error"}
                className="break-words"
              >
                {webState.message}
              </FormMessage>
            ) : null}
            {imageUploadError ? <FormMessage variant="error">{imageUploadError}</FormMessage> : null}

            <form
              ref={formRef}
              action={webFormAction}
              noValidate
              className="grid min-w-0 gap-6"
              onSubmit={handleSubmit}
              onChange={() => {
                clearClientFieldErrors();
                setImageUploadError(null);
              }}
            >
              <PartnerRegistrationStepProgress
                activeStep={activeStep}
                onStepClick={goToStep}
              />
              <input type="hidden" name="registrationMode" value={registrationMode} />
              {submissionId ? (
                <input type="hidden" name="idempotencyKey" value={submissionId} />
              ) : null}
              <input type="hidden" name="serviceMode" value={serviceMode} />
              <input
                type="hidden"
                name="benefitActionType"
                value={effectiveBenefitActionType}
              />
              <input type="hidden" name="branchScopeType" value={inferredBranchScopeType} />
              {branchEntryMode === "single" ? (
                <input type="hidden" name="branchListText" value="" />
              ) : null}
              {hiddenFields
                ? Object.entries(hiddenFields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                  ))
                : null}

              <section
                hidden={activeStep !== "brand"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    제휴처 정보
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    사용자에게 보일 제휴처명, 카테고리, 위치 또는 사이트 정보를 입력합니다.
                  </p>
                </div>

                <PartnerRegistrationModeSelector
                  value={registrationMode}
                  onChange={setRegistrationMode}
                />

                {brandProfiles.length > 0 ? (
                  <label className="grid min-w-0 gap-2">
                    <span className="ui-caption">기존 제휴처에서 복사</span>
                    <select
                      defaultValue=""
                      onChange={(event) => applyBrandProfile(event.currentTarget.value)}
                      className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground shadow-flat focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">직접 입력</option>
                      {brandProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      같은 파트너사의 기존 제휴처명을 선택하면 공통 정보 일부를 초안으로 채웁니다.
                    </span>
                  </label>
                ) : null}

                {typeSelector}

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="제휴처명" name="brandName" required error={fieldErrors.brandName}>
                    <FormInput
                      name="brandName"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("brandName")}
                      required
                      defaultValue={initialValues?.brandName}
                      placeholder="카페 싸피 역삼본점"
                    />
                  </Field>
                  <Field
                    label="카테고리"
                    name="categoryLabel"
                    required
                    description="목록에 없으면 새 카테고리명을 그대로 입력해 주세요."
                    error={fieldErrors.categoryLabel}
                  >
                    <FormInput
                      name="categoryLabel"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("categoryLabel")}
                      list="partner-registration-category-list"
                      required
                      defaultValue={initialValues?.categoryLabel}
                      placeholder="카페"
                    />
                    <datalist id="partner-registration-category-list">
                      {categories.map((category) => (
                        <option key={category.id} value={category.label} />
                      ))}
                    </datalist>
                  </Field>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  {serviceMode === "offline" ? (
                    <Field label="위치" name="location" required error={fieldErrors.location}>
                      <FormInput
                        name="location"
                        fieldErrors={fieldErrors}
                        inputRef={registerFieldRef("location")}
                        required
                        defaultValue={initialValues?.location}
                        placeholder="서울 강남구 테헤란로 212 1층"
                      />
                    </Field>
                  ) : (
                    <Field
                      label="사이트 링크"
                      name="siteLink"
                      required
                      error={fieldErrors.siteLink}
                    >
                      <FormInput
                        name="siteLink"
                        fieldErrors={fieldErrors}
                        inputRef={registerFieldRef("siteLink")}
                        required
                        defaultValue={initialValues?.siteLink}
                        placeholder="https://cafessafy.example.com"
                      />
                    </Field>
                  )}
                  <Field
                    label={serviceMode === "offline" ? "지도 URL" : "추가 사이트 URL"}
                    name="mapUrl"
                    description="네이버 지도, 카카오맵, 홈페이지 등 보조 링크를 입력합니다."
                    error={fieldErrors.mapUrl}
                  >
                    <FormInput
                      name="mapUrl"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("mapUrl")}
                      defaultValue={initialValues?.mapUrl}
                      placeholder={
                        serviceMode === "offline"
                          ? "https://map.naver.com/..."
                          : "https://service.example.com"
                      }
                    />
                  </Field>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="시작일" name="periodStart" error={fieldErrors.periodStart}>
                    <FormInput
                      type="date"
                      name="periodStart"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("periodStart")}
                      defaultValue={initialValues?.periodStart ?? partnerRegistrationInitialFormState.periodStart}
                    />
                  </Field>
                  <Field label="종료일" name="periodEnd" error={fieldErrors.periodEnd}>
                    <FormInput
                      type="date"
                      name="periodEnd"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("periodEnd")}
                      defaultValue={initialValues?.periodEnd ?? partnerRegistrationInitialFormState.periodEnd}
                    />
                  </Field>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field
                    label="제휴처 전화번호"
                    name="brandPhone"
                    description="매장 또는 제휴처 고객 응대 번호입니다."
                    error={fieldErrors.brandPhone}
                  >
                    <FormInput
                      name="brandPhone"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("brandPhone")}
                      defaultValue={initialValues?.brandPhone}
                      placeholder="02-3429-5100"
                    />
                  </Field>
                  <Field
                    label="문의 링크"
                    name="inquiryLink"
                    description="카카오 채널, 인스타그램, 홈페이지 문의 링크를 입력합니다."
                    error={fieldErrors.inquiryLink}
                  >
                    <FormInput
                      name="inquiryLink"
                      fieldErrors={fieldErrors}
                      inputRef={registerFieldRef("inquiryLink")}
                      defaultValue={initialValues?.inquiryLink}
                      placeholder="https://pf.kakao.com/_cafessafy"
                    />
                  </Field>
                </div>

                <Field
                  label="상세 설명"
                  name="detailDescription"
                  description="제휴처 소개와 이용 장면을 1~3문장으로 입력해 주세요."
                  error={fieldErrors.detailDescription}
                >
                  <FormTextarea
                    name="detailDescription"
                    fieldErrors={fieldErrors}
                    inputRef={registerFieldRef("detailDescription")}
                    rows={4}
                    defaultValue={initialValues?.detailDescription}
                    placeholder="SSAFY 서울캠퍼스 인근에서 이용하기 좋은 가상의 프랜차이즈 카페입니다."
                  />
                </Field>
              </section>

              <section
                hidden={activeStep !== "scope"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    적용 지점
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    지점 코드는 선택입니다. 캠퍼스는 주소로 자동 분류하고, 추론이 어려운 주소는 관리자 검토 단계에서 보정합니다.
                  </p>
                </div>

                {serviceMode === "offline" ? (
                  <>
                    <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          지점 구성
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          하나의 지점이면 지점 목록 입력을 건너뛰고, 여러 지점이면 리스트로 적용 지점을 관리합니다.
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                        <PartnerRegistrationOptionChip
                          value="single"
                          selected={branchEntryMode === "single"}
                          label="단일 지점"
                          description="제휴처 위치를 그대로 적용 지점으로 등록합니다."
                          onClick={setBranchEntryMode}
                        />
                        <PartnerRegistrationOptionChip
                          value="multi"
                          selected={branchEntryMode === "multi"}
                          label="다중 지점"
                          description="XLSX 업로드 또는 행 추가로 지점 목록을 입력합니다."
                          onClick={setBranchEntryMode}
                        />
                      </div>
                    </section>

                    <Field
                      label="적용 범위 메모"
                      name="branchScopeNote"
                      description="예: 역삼·강남 직영점만 참여, 일부 가맹점 제외, 전체 직영점 참여"
                      error={fieldErrors.branchScopeNote}
                    >
                      <FormTextarea
                        name="branchScopeNote"
                        fieldErrors={fieldErrors}
                        inputRef={registerFieldRef("branchScopeNote")}
                        rows={3}
                        defaultValue={initialValues?.branchScopeNote}
                        placeholder="직영점 일부만 참여하며, 가맹점은 이번 제휴에서 제외됩니다."
                      />
                    </Field>

                    {branchEntryMode === "multi" ? (
                      <PartnerBranchListEditor
                        rows={branchRows}
                        serializedValue={branchListText}
                        inferredScopeType={inferredBranchScopeType}
                        error={fieldErrors.branchListText}
                        onChange={setBranchRows}
                        inputRef={registerFieldRef("branchListText")}
                      />
                    ) : (
                      <div className="rounded-[1rem] border border-primary/15 bg-primary-soft px-4 py-3 text-sm leading-6 text-primary">
                        단일 지점은 제휴처 위치와 지도 URL을 기준으로 등록됩니다.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-[1rem] border border-primary/15 bg-primary-soft px-4 py-3 text-sm leading-6 text-primary">
                    온라인 제휴처는 사이트 링크 기준으로 등록하고 지점 목록은 받지 않습니다.
                  </div>
                )}
              </section>

              <PartnerRegistrationMediaStep active={activeStep === "media"} />

              <section
                hidden={activeStep !== "benefit"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    혜택과 이용 조건
                  </h2>
                  <p className="mt-1 text-ko-pretty text-sm leading-6 text-muted-foreground">
                    상시 노출할 혜택이 있는지, 소모성 쿠폰만 운영하는지 먼저 선택합니다.
                  </p>
                </div>

                <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      혜택 구성
                    </p>
                    <p className="mt-1 text-ko-pretty text-xs leading-5 text-muted-foreground">
                      상세 카드에 항상 보일 혜택을 입력하거나, 수량과 사용 기간이 있는 쿠폰만 운영하도록 설정합니다.
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <PartnerRegistrationOptionChip
                      value="always_on"
                      selected={benefitListingMode === "always_on"}
                      label="상시 혜택 있음"
                      description="상세 카드에 노출할 혜택과 조건을 직접 입력합니다."
                      onClick={handleBenefitListingModeChange}
                    />
                    <PartnerRegistrationOptionChip
                      value="coupon_only"
                      selected={benefitListingMode === "coupon_only"}
                      label="소모성 쿠폰만 제공"
                      description="쿠폰별 수량, 기간, 조건을 별도로 운영합니다."
                      onClick={handleBenefitListingModeChange}
                    />
                  </div>
                </section>

                {benefitListingMode === "coupon_only" ? (
                  <>
                    <input
                      type="hidden"
                      name="benefits"
                      value={COUPON_ONLY_BENEFIT_TEXT}
                    />
                    <input
                      type="hidden"
                      name="conditions"
                      value={COUPON_ONLY_CONDITION_TEXT}
                    />
                    <div className="grid min-w-0 gap-3 rounded-[1rem] border border-primary/15 bg-primary-soft p-4 text-primary">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          쿠폰 전용 제휴처로 접수
                        </p>
                        <p className="mt-1 text-ko-pretty text-sm leading-6">
                          상시 할인 문구 없이 등록하고, 승인 후 쿠폰 관리에서 쿠폰명, 수량, 사용 기간, 1인당 사용 횟수를 설정합니다.
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                        <div className="grid min-w-0 gap-1 rounded-[0.85rem] border border-primary/15 bg-surface/80 px-3 py-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            제출 혜택
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {COUPON_ONLY_BENEFIT_TEXT}
                          </span>
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-[0.85rem] border border-primary/15 bg-surface/80 px-3 py-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            제출 조건
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {COUPON_ONLY_CONDITION_TEXT}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {benefitActionType === "external_link" ? (
                      <Field
                        label="혜택 이용 링크"
                        name="benefitActionLink"
                        required
                        error={fieldErrors.benefitActionLink}
                      >
                        <FormInput
                          name="benefitActionLink"
                          fieldErrors={fieldErrors}
                          inputRef={registerFieldRef("benefitActionLink")}
                          required
                          defaultValue={initialValues?.benefitActionLink}
                          placeholder="https://cafessafy.example.com/coupon"
                        />
                      </Field>
                    ) : null}

                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <Field
                        label="혜택"
                        name="benefits"
                        required
                        error={fieldErrors.benefits}
                      >
                        <TokenChipField
                          id="partner-registration-benefits"
                          name="benefits"
                          inputRef={registerFieldRef("benefits")}
                          initialValues={splitInitialChipValues(initialValues?.benefits)}
                          placeholder="예: 아메리카노 10% 할인"
                          helpText="Enter로 혜택을 하나씩 추가합니다."
                          emptyText="등록된 혜택이 없습니다."
                          error={fieldErrors.benefits}
                        />
                      </Field>
                      <Field
                        label="이용 조건"
                        name="conditions"
                        required
                        error={fieldErrors.conditions}
                      >
                        <TokenChipField
                          id="partner-registration-conditions"
                          name="conditions"
                          inputRef={registerFieldRef("conditions")}
                          initialValues={splitInitialChipValues(initialValues?.conditions)}
                          placeholder="예: 싸트너십 인증"
                          helpText="Enter로 조건을 하나씩 추가합니다."
                          emptyText="등록된 이용 조건이 없습니다."
                          error={fieldErrors.conditions}
                        />
                      </Field>
                    </div>
                  </>
                )}

                <Field label="태그" name="tags" error={fieldErrors.tags}>
                  <TokenChipField
                    id="partner-registration-tags"
                    name="tags"
                    inputRef={registerFieldRef("tags")}
                    initialValues={splitInitialChipValues(initialValues?.tags)}
                    placeholder="예: 카페"
                    helpText="검색과 분류에 사용할 태그를 Enter로 추가합니다."
                    emptyText="등록된 태그가 없습니다."
                    error={fieldErrors.tags}
                  />
                </Field>
              </section>

              <PartnerRegistrationContactStep
                active={activeStep === "contact"}
                fieldErrors={fieldErrors}
                registerFieldRef={registerFieldRef}
                initialValues={initialValues}
                lockCompanyName={lockCompanyName}
              />

              <div className="flex min-w-0 flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {isLastStep
                    ? "제출 즉시 공개되지 않습니다. 공통 제휴처 정보, 혜택 그룹, 적용 지점 수, 제외 범위를 관리자가 확인합니다."
                    : "현재 단계의 필수값을 확인한 뒤 다음 단계로 이동합니다."}
                </p>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-end">
                  {currentStepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={goToPreviousStep}
                    >
                      이전
                    </Button>
                  ) : null}
                  {isLastStep ? (
                    <SubmitButton pendingText={submitPendingLabel} className="w-full sm:w-auto">
                      <PhotoIcon className="h-4 w-4" />
                      {submitLabel}
                    </SubmitButton>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full sm:w-auto"
                      onClick={goToNextStep}
                    >
                      다음 단계
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </Card>
        {showExcelTab && excelAction ? (
          <PartnerRegistrationBulkDisclosure
            action={excelAction}
            serviceMode={serviceMode}
            benefitActionType={benefitActionType}
            onServiceModeChange={handleServiceModeChange}
            onBenefitActionTypeChange={handleBenefitActionTypeChange}
          />
        ) : null}
      </div>
    </ImageUploadSubmissionProvider>
  );
}
