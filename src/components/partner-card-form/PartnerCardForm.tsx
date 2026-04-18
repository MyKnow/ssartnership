"use client";

import type { PartnerVisibility } from "@/lib/types";
import usePartnerCardFormState from "@/components/partner-card-form/usePartnerCardFormState";
import PartnerFormHero from "@/components/partner-card-form/PartnerFormHero";
import PartnerBasicInfoSection from "@/components/partner-card-form/PartnerBasicInfoSection";
import PartnerCompanySection from "@/components/partner-card-form/PartnerCompanySection";
import PartnerChipSections from "@/components/partner-card-form/PartnerChipSections";
import PartnerAudienceSection from "@/components/partner-card-form/PartnerAudienceSection";
import PartnerFormActions from "@/components/partner-card-form/PartnerFormActions";
import { cn } from "@/lib/cn";
import type {
  PartnerCardCategoryOption,
  PartnerCardCompanyOption,
  PartnerCardFormField,
  PartnerCardFormMode,
  PartnerCardFormValues,
} from "@/components/partner-card-form/types";

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
}) {
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
    categoryValue,
    setCategoryValue,
    periodStartValue,
    setPeriodStartValue,
    periodEndValue,
    setPeriodEndValue,
    locationValue,
    setLocationValue,
    mapUrlValue,
    setMapUrlValue,
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

  return (
    <article className={cn("grid gap-6", className)}>
      <PartnerFormHero
        mode={mode}
        visibilityValue={visibilityValue as PartnerVisibility}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      <form ref={formRef} action={formAction} className="grid gap-6">
        {mode === "edit" && partner.id ? (
          <input type="hidden" name="id" value={partner.id} />
        ) : null}
        {hiddenFields?.map((field) => (
          <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
        ))}

        <div className="grid gap-6">
          <PartnerBasicInfoSection
            partner={partner}
            categoryOptions={categoryOptions}
            fieldErrors={fieldErrors}
            focusField={focusField}
            values={{
              nameValue,
              visibilityValue,
              categoryValue,
              periodStartValue,
              periodEndValue,
              locationValue,
              mapUrlValue,
              reservationLinkValue,
              inquiryLinkValue,
            }}
            setters={{
              setNameValue,
              setVisibilityValue: (value) => setVisibilityValue(value),
              setCategoryValue,
              setPeriodStartValue,
              setPeriodEndValue,
              setLocationValue,
              setMapUrlValue,
              setReservationLinkValue,
              setInquiryLinkValue,
            }}
          />

          <PartnerCompanySection
            companyOptions={companyOptions}
            fieldErrors={fieldErrors}
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

          <PartnerChipSections partner={partner} />

          <PartnerAudienceSection
            appliesToValue={appliesToValue}
            setAppliesToValue={(updater) =>
              setAppliesToValue((current) => updater(current))
            }
            fieldErrors={fieldErrors}
          />

          <PartnerFormActions
            mode={mode}
            partnerId={partner.id}
            deleteAction={deleteAction}
            submitLabel={submitLabel}
            formError={formError}
          />
        </div>
      </form>
    </article>
  );
}
