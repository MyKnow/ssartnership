"use client";

import { useActionState, useMemo } from "react";
import PartnerCardForm, {
  type PartnerCardFormField,
  type PartnerCardFormValues,
  type PartnerCardCategoryOption,
  type PartnerCardCompanyOption,
} from "@/components/PartnerCardForm";
import { createPartnerFormAction } from "@/app/admin/(protected)/actions";
import {
  PARTNER_CREATE_FORM_INITIAL_STATE,
  type PartnerCreateFormState,
} from "@/lib/partner-form-state";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";

const partnerFormFocusByError: Record<string, PartnerCardFormField> = {
  partner_form_missing_required: "name",
  partner_form_missing_name: "name",
  partner_form_missing_category: "categoryId",
  partner_form_missing_location: "location",
  partner_form_invalid_campus_slugs: "campusSlugs",
  partner_form_invalid_period: "periodStart",
  partner_form_invalid_map_url: "mapUrl",
  partner_form_invalid_benefit_action_type: "benefitActionType",
  partner_form_invalid_benefit_action_link: "benefitActionLink",
  partner_form_invalid_reservation_url: "reservationLink",
  partner_form_invalid_inquiry_url: "inquiryLink",
  partner_form_invalid_visibility: "visibility",
  partner_form_invalid_benefit_visibility: "benefitVisibility",
  partner_form_invalid_applies_to: "appliesTo",
  partner_company_missing_name: "companyName",
  partner_company_missing_email: "companyContactEmail",
  partner_company_invalid_email: "companyContactEmail",
};

function buildFieldErrors(state: PartnerCreateFormState) {
  if (state.status !== "error" || !state.errorCode) {
    return undefined;
  }
  const focusField = partnerFormFocusByError[state.errorCode];
  const message = partnerFormErrorMessages[state.errorCode];
  if (!focusField || !message) {
    return undefined;
  }
  return { [focusField]: message } as Partial<Record<PartnerCardFormField, string>>;
}

export default function AdminPartnerCreateForm({
  partner,
  categoryOptions,
  companyOptions,
  categoryId,
}: {
  partner: PartnerCardFormValues;
  categoryOptions: PartnerCardCategoryOption[];
  companyOptions: PartnerCardCompanyOption[];
  categoryId: string;
}) {
  const [state, formAction] = useActionState(
    createPartnerFormAction,
    PARTNER_CREATE_FORM_INITIAL_STATE,
  );

  const fieldErrors = useMemo(() => buildFieldErrors(state), [state]);
  const focusField =
    state.status === "error" && state.errorCode
      ? partnerFormFocusByError[state.errorCode]
      : undefined;
  const formError =
    state.status === "error" && state.errorCode && !fieldErrors
      ? partnerFormErrorMessages[state.errorCode] ??
        "브랜드를 추가하지 못했습니다. 입력값을 확인해 주세요."
      : null;

  return (
    <PartnerCardForm
      mode="create"
      partner={partner}
      categoryOptions={categoryOptions}
      companyOptions={companyOptions}
      categoryId={categoryId}
      formAction={formAction}
      submitLabel="브랜드 추가"
      className="mt-6"
      focusField={focusField}
      fieldErrors={fieldErrors}
      formError={formError}
    />
  );
}
