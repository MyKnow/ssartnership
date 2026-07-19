"use client";

import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import type { PartnerVisibility } from "@/lib/types";
import usePartnerCardFormState from "@/components/partner-card-form/usePartnerCardFormState";
import PartnerFormHero from "@/components/partner-card-form/PartnerFormHero";
import PartnerBasicInfoSection from "@/components/partner-card-form/PartnerBasicInfoSection";
import PartnerCompanySection from "@/components/partner-card-form/PartnerCompanySection";
import PartnerChipSections from "@/components/partner-card-form/PartnerChipSections";
import PartnerAudienceSection from "@/components/partner-card-form/PartnerAudienceSection";
import PartnerFormActions from "@/components/partner-card-form/PartnerFormActions";
import PartnerBranchListEditor, {
  branchRowHasValue,
  parseInitialBranchEditorRows,
  serializeBranchRows,
  type BranchEditorRow,
} from "@/components/partner-branches/PartnerBranchListEditor";
import { cn } from "@/lib/cn";
import {
  normalizeCampusSlugs,
  validateFormCampusSlugSelection,
} from "@/lib/campuses";
import { isPartnerBenefitActionType } from "@/lib/partner-benefit-action";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { sanitizePartnerLinkValue } from "@/lib/validation";
import { isPartnerDetailDescriptionValid } from "@/lib/partner-detail-description";
import { isPartnerFormRequestWithinSafeLimit } from "@/lib/partner-form-request-size";
import ImageUploadSubmissionProvider, {
  type ImageUploadSubmissionController,
} from "@/components/media/ImageUploadSubmissionProvider";
import { useImageUploadFormDraft } from "@/components/media/useImageUploadFormDraft";
import { useImageUploadSubmissionId } from "@/components/media/useImageUploadSubmissionId";
import type { ImageUploadDraftValue } from "@/lib/image-upload/draft";
import {
  PARTNER_CARD_CREATE_DRAFT_KEY,
  PARTNER_CARD_DRAFT_VALUE_KEY,
  createPartnerCardDraftSnapshot,
  readPartnerCardDraftSnapshot,
  serializePartnerCardDraftSnapshot,
  type PartnerCardDraftSnapshot,
} from "@/lib/partner-card-form/draft";
import {
  inferPartnerBranchScopeType,
  type PartnerBranchScopeType,
} from "@/lib/partner-branch-registration";
import {
  getBenefitListingMode,
  removeCouponOnlyDefaults,
  type BenefitListingMode,
} from "@/lib/partner-coupon-only";
import type {
  PartnerCardCategoryOption,
  PartnerCardCompanyOption,
  PartnerCardFormField,
  PartnerCardFormMode,
  PartnerCardFormValues,
} from "@/components/partner-card-form/types";

type BranchEntryMode = "single" | "multi";

function readDraftListValue(form: HTMLFormElement, name: string) {
  const input = form.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="${name}"]`,
  );
  return (input?.value ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readCheckedDraftValues(form: HTMLFormElement, name: string) {
  return Array.from(
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`),
  ).map((input) => input.value.trim()).filter(Boolean);
}

export default function PartnerCardForm({
  partner,
  mode = "edit",
  categoryOptions,
  companyOptions,
  categoryId,
  formAction,
  deleteAction,
  submitLabel,
  className,
  focusField,
  fieldErrors,
  formError,
  hiddenFields,
  clearDraftOnSuccess = false,
}: {
  partner: PartnerCardFormValues;
  mode?: PartnerCardFormMode;
  categoryOptions?: PartnerCardCategoryOption[];
  companyOptions?: PartnerCardCompanyOption[];
  categoryId?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  className?: string;
  focusField?: PartnerCardFormField;
  fieldErrors?: Partial<Record<PartnerCardFormField, string>>;
  formError?: string | null;
  hiddenFields?: Array<{ name: string; value: string }>;
  clearDraftOnSuccess?: boolean;
}) {
  const [clientFieldErrors, setClientFieldErrors] = useState<
    Partial<Record<PartnerCardFormField, string>>
  >({});
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const imageUploadControllerRef = useRef<ImageUploadSubmissionController | null>(null);
  const isSubmittingImagesRef = useRef(false);
  const allowUploadedFormSubmitRef = useRef(false);
  const [branchEntryMode, setBranchEntryMode] =
    useState<BranchEntryMode>("single");
  const [benefitListingMode, setBenefitListingMode] =
    useState<BenefitListingMode>(() =>
      getBenefitListingMode({
        benefits: partner.benefits,
        conditions: partner.conditions,
      }),
    );
  const [branchRows, setBranchRows] = useState<BranchEditorRow[]>(() =>
    parseInitialBranchEditorRows(),
  );
  const [restoredDraftValues, setRestoredDraftValues] =
    useState<PartnerCardDraftSnapshot | null>(null);
  const [draftRestoreVersion, setDraftRestoreVersion] = useState(0);
  const {
    formRef,
    periodStart,
    periodEnd,
    selectedCompanyId,
    setSelectedCompanyId,
    nameValue,
    setNameValue,
    visibilityValue,
    setVisibilityValue,
    benefitVisibilityValue,
    setBenefitVisibilityValue,
    categoryValue,
    setCategoryValue,
    serviceModeValue,
    setServiceModeValue,
    periodStartValue,
    setPeriodStartValue,
    periodEndValue,
    setPeriodEndValue,
    locationValue,
    setLocationValue,
    detailDescriptionValue,
    setDetailDescriptionValue,
    mapUrlValue,
    setMapUrlValue,
    benefitActionTypeValue,
    setBenefitActionTypeValue,
    benefitActionLinkValue,
    setBenefitActionLinkValue,
    reservationLinkValue,
    setReservationLinkValue,
    inquiryLinkValue,
    setInquiryLinkValue,
    companyNameValue,
    setCompanyNameValue,
    companyContactNameValue,
    setCompanyContactNameValue,
    companyContactEmailValue,
    setCompanyContactEmailValue,
    companyContactPhoneValue,
    setCompanyContactPhoneValue,
    companyDescriptionValue,
    setCompanyDescriptionValue,
    appliesToValue,
    setAppliesToValue,
    companyFieldsLocked,
  } = usePartnerCardFormState({ partner, categoryId, focusField });
  const branchListText = useMemo(
    () => (branchEntryMode === "multi" ? serializeBranchRows(branchRows) : ""),
    [branchEntryMode, branchRows],
  );
  const inferredBranchScopeType = useMemo<PartnerBranchScopeType>(() => {
    if (serviceModeValue === "online") {
      return "online";
    }
    if (branchEntryMode === "single") {
      return "single_location";
    }
    return inferPartnerBranchScopeType({
      serviceMode: serviceModeValue,
      branches: branchRows.filter(branchRowHasValue),
      fallback: "selected_direct_branches",
    });
  }, [branchEntryMode, branchRows, serviceModeValue]);

  const restorePartnerDraftValues = useCallback(
    (values: Record<string, ImageUploadDraftValue>) => {
      const restored = readPartnerCardDraftSnapshot(
        values[PARTNER_CARD_DRAFT_VALUE_KEY],
      );
      if (!restored) return;
      setBranchEntryMode(restored.branchEntryMode);
      setBenefitListingMode(restored.benefitListingMode);
      setBranchRows(parseInitialBranchEditorRows(restored.branchListText));
      setAppliesToValue(restored.appliesTo);
      setRestoredDraftValues(restored);
      setDraftRestoreVersion((current) => current + 1);
    },
    [setAppliesToValue],
  );

  const getPartnerDraftValues = useCallback(() => {
    const form = formRef.current;
    const snapshot = createPartnerCardDraftSnapshot({
      branchEntryMode,
      benefitListingMode,
      branchListText,
      conditions: form ? readDraftListValue(form, "conditions") : [],
      benefits: form ? readDraftListValue(form, "benefits") : [],
      tags: form ? readDraftListValue(form, "tags") : [],
      appliesTo: form ? readCheckedDraftValues(form, "appliesTo") : appliesToValue,
      campusSlugs: form ? readCheckedDraftValues(form, "campusSlugs") : [],
    });
    return {
      [PARTNER_CARD_DRAFT_VALUE_KEY]: serializePartnerCardDraftSnapshot(snapshot),
    };
  }, [
    appliesToValue,
    benefitListingMode,
    branchEntryMode,
    branchListText,
    formRef,
  ]);

  const draftKey =
    mode === "create"
      ? PARTNER_CARD_CREATE_DRAFT_KEY
      : `admin-partner-${mode}-${partner.id ?? "new"}`;
  const submissionId = useImageUploadSubmissionId(draftKey);
  const {
    saveDraft,
    clearDraft,
    draftStatus,
  } = useImageUploadFormDraft({
    formKey: draftKey,
    formRef,
    imageUploadControllerRef,
    getAdditionalDraftValues: getPartnerDraftValues,
    restoreAdditionalDraftValues: restorePartnerDraftValues,
    clearOnSuccess: clearDraftOnSuccess,
  });

  const mergedFieldErrors = useMemo(
    () => ({
      ...fieldErrors,
      ...clientFieldErrors,
    }),
    [fieldErrors, clientFieldErrors],
  );
  const restoredCampusSlugs = restoredDraftValues
    ? normalizeCampusSlugs(restoredDraftValues.campusSlugs)
    : undefined;

  const preserveCurrentPartnerDraftValues = useCallback(() => {
    const form = formRef.current;
    const snapshot = createPartnerCardDraftSnapshot({
      branchEntryMode,
      benefitListingMode,
      branchListText,
      conditions:
        benefitListingMode === "always_on"
          ? form
            ? readDraftListValue(form, "conditions")
            : []
          : restoredDraftValues?.conditions ?? removeCouponOnlyDefaults(partner.conditions),
      benefits:
        benefitListingMode === "always_on"
          ? form
            ? readDraftListValue(form, "benefits")
            : []
          : restoredDraftValues?.benefits ?? removeCouponOnlyDefaults(partner.benefits),
      tags: form
        ? readDraftListValue(form, "tags")
        : restoredDraftValues?.tags ?? partner.tags ?? [],
      appliesTo: form
        ? readCheckedDraftValues(form, "appliesTo")
        : appliesToValue,
      campusSlugs: form
        ? readCheckedDraftValues(form, "campusSlugs")
        : restoredDraftValues?.campusSlugs ?? [],
    });
    setRestoredDraftValues(snapshot);
    setDraftRestoreVersion((current) => current + 1);
  }, [
    appliesToValue,
    benefitListingMode,
    branchEntryMode,
    branchListText,
    formRef,
    partner.benefits,
    partner.conditions,
    partner.tags,
    restoredDraftValues,
  ]);

  const handleBenefitListingModeChange = (value: BenefitListingMode) => {
    preserveCurrentPartnerDraftValues();
    setBenefitListingMode(value);
    if (value === "coupon_only") {
      setBenefitActionTypeValue("none");
      setBenefitActionLinkValue("");
      setReservationLinkValue("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (allowUploadedFormSubmitRef.current) {
      allowUploadedFormSubmitRef.current = false;
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (formData.get("partnerFormIntent") === "delete") {
      return;
    }
    const location = String(formData.get("location") || "").trim();
    const benefitActionType = String(formData.get("benefitActionType") || "").trim();
    const benefitActionLink = String(formData.get("benefitActionLink") || "").trim();
    const detailDescription = String(formData.get("detailDescription") || "").trim();
    const campusSlugSelection = validateFormCampusSlugSelection(
      formData.getAll("campusSlugs").map((item) => String(item).trim()),
      location,
    );
    const benefitActionError =
      benefitActionType && !isPartnerBenefitActionType(benefitActionType)
        ? {
            field: "benefitActionType" as const,
            message: partnerFormErrorMessages.partner_form_invalid_benefit_action_type,
          }
        : benefitActionType === "external_link" &&
            !sanitizePartnerLinkValue(benefitActionLink)
          ? {
              field: "benefitActionLink" as const,
              message: partnerFormErrorMessages.partner_form_invalid_benefit_action_link,
            }
          : null;
    const detailDescriptionError = !isPartnerDetailDescriptionValid(
      detailDescription,
    )
      ? {
          field: "detailDescription" as const,
          message: partnerFormErrorMessages.partner_form_invalid_detail_description,
        }
      : null;

    if (campusSlugSelection.ok && !benefitActionError && !detailDescriptionError) {
      const imageUploadController = imageUploadControllerRef.current;
      if (imageUploadController?.hasPendingUploads()) {
        event.preventDefault();
        if (isSubmittingImagesRef.current) {
          return;
        }
        isSubmittingImagesRef.current = true;
        setClientFormError(null);
        try {
          await saveDraft();
          await imageUploadController.uploadPending();
          await saveDraft();
          allowUploadedFormSubmitRef.current = true;
          form.requestSubmit();
        } catch (error) {
          setClientFormError(
            error instanceof Error && error.message
              ? error.message
              : "이미지를 업로드하지 못했습니다. 입력 내용은 유지되므로 다시 시도해 주세요.",
          );
        } finally {
          isSubmittingImagesRef.current = false;
        }
        return;
      }
      void saveDraft();
      if (!isPartnerFormRequestWithinSafeLimit(formData)) {
        event.preventDefault();
        setClientFormError(
          "제출 데이터가 너무 큽니다. 입력한 내용은 유지되므로 텍스트 또는 지점 목록을 줄인 뒤 다시 시도해 주세요.",
        );
        return;
      }

      setClientFormError(null);
      setClientFieldErrors((current) => {
        if (
          !current.campusSlugs &&
          !current.benefitActionType &&
          !current.benefitActionLink &&
          !current.detailDescription
        ) {
          return current;
        }
        const {
          campusSlugs: _campusSlugs,
          benefitActionType: _benefitActionType,
          benefitActionLink: _benefitActionLink,
          detailDescription: _detailDescription,
          ...nextErrors
        } = current;
        void _campusSlugs;
        void _benefitActionType;
        void _benefitActionLink;
        void _detailDescription;
        return nextErrors;
      });
      return;
    }

    event.preventDefault();
    setClientFieldErrors((current) => ({
      ...current,
      ...(!campusSlugSelection.ok
        ? {
            campusSlugs: partnerFormErrorMessages.partner_form_invalid_campus_slugs,
          }
        : {}),
      ...(benefitActionError
        ? { [benefitActionError.field]: benefitActionError.message }
        : {}),
      ...(detailDescriptionError
        ? { detailDescription: detailDescriptionError.message }
        : {}),
    }));
    if (!campusSlugSelection.ok) {
      event.currentTarget
        .querySelector<HTMLInputElement>('input[name="campusSlugs"]')
        ?.focus();
      return;
    }
    event.currentTarget
      .querySelector<HTMLElement>(
        `[name="${benefitActionError?.field ?? detailDescriptionError?.field}"]`,
      )
      ?.focus();
  };

  return (
    <ImageUploadSubmissionProvider
      purpose="partner"
      actorMode="admin"
      draftKey={draftKey}
      controllerRef={imageUploadControllerRef}
    >
      <article className={cn("grid gap-6", className)}>
      <PartnerFormHero
        mode={mode}
        visibilityValue={visibilityValue as PartnerVisibility}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        onChange={() => setClientFormError(null)}
        className="grid gap-6"
      >
        {mode === "edit" && partner.id ? (
          <input type="hidden" name="id" value={partner.id} />
        ) : null}
        {mode === "create" && submissionId ? (
          <input type="hidden" name="idempotencyKey" value={submissionId} />
        ) : null}
        {hiddenFields?.map((field) => (
          <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
        ))}
        {mode === "create" ? (
          <>
            <input
              type="hidden"
              name="branchScopeType"
              value={inferredBranchScopeType}
            />
            {branchEntryMode === "single" ? (
              <input type="hidden" name="branchListText" value="" />
            ) : null}
          </>
        ) : null}

        <div className="grid gap-6">
          <PartnerBasicInfoSection
            partner={partner}
            categoryOptions={categoryOptions}
            fieldErrors={mergedFieldErrors}
            focusField={focusField}
            draftRestoreVersion={draftRestoreVersion}
            restoredCampusSlugs={restoredCampusSlugs}
            onCampusSlugSelectionChange={(value) => {
              if (value.length > 0) {
                setClientFieldErrors((current) => {
                  if (!current.campusSlugs) {
                    return current;
                  }
                  const { campusSlugs: _campusSlugs, ...nextErrors } = current;
                  void _campusSlugs;
                  return nextErrors;
                });
              }
            }}
            values={{
              nameValue,
              visibilityValue,
              benefitVisibilityValue,
              categoryValue,
              serviceModeValue,
              periodStartValue,
              periodEndValue,
              locationValue,
              detailDescriptionValue,
              mapUrlValue,
              benefitActionTypeValue,
              benefitActionLinkValue,
              reservationLinkValue,
              inquiryLinkValue,
            }}
            setters={{
              setNameValue,
              setVisibilityValue: (value) => setVisibilityValue(value),
              setBenefitVisibilityValue,
              setCategoryValue,
              setServiceModeValue: (value) => {
                setServiceModeValue(value);
                if (value === "online") {
                  setBranchEntryMode("single");
                }
              },
              setPeriodStartValue,
              setPeriodEndValue,
              setLocationValue,
              setDetailDescriptionValue,
              setMapUrlValue,
              setBenefitActionTypeValue: (value) => {
                setBenefitActionTypeValue(value);
                if (benefitListingMode === "coupon_only" && value !== "none") {
                  preserveCurrentPartnerDraftValues();
                  setBenefitListingMode("always_on");
                }
              },
              setBenefitActionLinkValue,
              setReservationLinkValue,
              setInquiryLinkValue,
            }}
          />

          <PartnerCompanySection
            companyOptions={companyOptions}
            fieldErrors={mergedFieldErrors}
            focusField={focusField}
            companyFieldsLocked={companyFieldsLocked}
            values={{
              selectedCompanyId,
              companyNameValue,
              companyContactNameValue,
              companyContactEmailValue,
              companyContactPhoneValue,
              companyDescriptionValue,
            }}
            setters={{
              setSelectedCompanyId,
              setCompanyNameValue,
              setCompanyContactNameValue,
              setCompanyContactEmailValue,
              setCompanyContactPhoneValue,
              setCompanyDescriptionValue,
            }}
          />

          {mode === "create" && serviceModeValue === "offline" ? (
            <section className="grid gap-5 rounded-[1.25rem] border border-border bg-surface p-5 shadow-flat">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  지점 및 혜택 그룹
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  단일 지점은 기본 위치를 사용하고, 다중 지점은 XLSX 또는 행 추가로 적용 지점을 연결합니다.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      value: "single",
                      label: "단일 지점",
                      description: "제휴처의 지점 위치를 그대로 적용합니다.",
                    },
                    {
                      value: "multi",
                      label: "다중 지점",
                      description: "지점 리스트와 G01 그룹을 함께 관리합니다.",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={branchEntryMode === option.value}
                    onClick={() => setBranchEntryMode(option.value)}
                    className={cn(
                      "grid min-h-20 min-w-0 gap-1 rounded-[1rem] border px-4 py-3 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                      branchEntryMode === option.value
                        ? "border-primary/35 bg-primary-soft text-primary"
                        : "border-border bg-surface-control text-foreground hover:border-strong hover:bg-surface-elevated",
                    )}
                  >
                    <span className="truncate text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              <label className="grid min-w-0 gap-2">
                <span className="ui-caption">적용 범위 메모</span>
                <textarea
                  name="branchScopeNote"
                  rows={3}
                  placeholder="예: 직영점 일부만 참여, 일부 가맹점 제외"
                  className="min-h-24 rounded-[1rem] border border-border bg-surface-control px-3 py-3 text-sm text-foreground shadow-flat outline-none transition-interactive placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              {branchEntryMode === "multi" ? (
                <PartnerBranchListEditor
                  rows={branchRows}
                  serializedValue={branchListText}
                  inferredScopeType={inferredBranchScopeType}
                  onChange={setBranchRows}
                  title="어드민 적용 지점 목록"
                  description="업로드한 XLSX 값은 리스트에 즉시 반영되며, 제출 시 지점 원장과 카드 연결로 저장됩니다."
                />
              ) : (
                <div className="rounded-[1rem] border border-primary/15 bg-primary-soft px-4 py-3 text-sm leading-6 text-primary">
                  단일 지점은 기본 정보의 위치, 지도 URL, 전화번호를 기준으로 연결됩니다.
                </div>
              )}
            </section>
          ) : null}

          <PartnerChipSections
            partner={partner}
            benefitListingMode={benefitListingMode}
            onBenefitListingModeChange={handleBenefitListingModeChange}
            restoredDraftValues={restoredDraftValues}
            draftRestoreVersion={draftRestoreVersion}
          />

          <PartnerAudienceSection
            appliesToValue={appliesToValue}
            setAppliesToValue={(updater) =>
              setAppliesToValue((current) => updater(current))
            }
            fieldErrors={mergedFieldErrors}
          />

          <PartnerFormActions
            mode={mode}
            partnerId={partner.id}
            deleteAction={deleteAction}
            submitLabel={submitLabel}
            formError={clientFormError ?? formError}
            draftStatus={mode === "create" ? draftStatus : undefined}
            onSaveDraft={mode === "create" ? () => void saveDraft(true) : undefined}
            onClearDraft={mode === "create" ? () => void clearDraft() : undefined}
          />
        </div>
      </form>
      </article>
    </ImageUploadSubmissionProvider>
  );
}
