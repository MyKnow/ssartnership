"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PARTNER_AUDIENCE,
  normalizePartnerAudience,
} from "../../lib/partner-audience.ts";
import { resolvePartnerBenefitActionType } from "../../lib/partner-benefit-action.ts";
import {
  ONLINE_PARTNER_LOCATION,
  getPartnerServiceMode,
  type PartnerServiceMode,
} from "../../lib/partner-service-mode.ts";
import type {
  PartnerCardFormField,
  PartnerCardFormValues,
} from "./types.ts";

export function getCompanyFieldsLocked(selectedCompanyId: string) {
  return Boolean(selectedCompanyId);
}

export function getPartnerCardInvalidClass(hasError: boolean) {
  return hasError ? "border-danger/40 ring-2 ring-danger/15" : undefined;
}

export function createPartnerCardFormState(
  partner: PartnerCardFormValues,
  categoryId?: string,
) {
  return {
    periodStart: partner.period?.start ?? "",
    periodEnd: partner.period?.end ?? "",
    selectedCompanyId: partner.company?.id ?? "",
    nameValue: partner.name ?? "",
    visibilityValue: partner.visibility ?? "public",
    benefitVisibilityValue: partner.benefitVisibility ?? "public",
    categoryValue: categoryId ?? "",
    serviceModeValue: getPartnerServiceMode(partner.location),
    locationValue: partner.location ?? "",
    mapUrlValue: partner.mapUrl ?? "",
    benefitActionTypeValue: resolvePartnerBenefitActionType(partner),
    benefitActionLinkValue: partner.benefitActionLink ?? partner.reservationLink ?? "",
    reservationLinkValue: partner.reservationLink ?? "",
    inquiryLinkValue: partner.inquiryLink ?? "",
    companyNameValue: partner.company?.name ?? "",
    companyContactNameValue: partner.company?.contactName ?? "",
    companyContactEmailValue: partner.company?.contactEmail ?? "",
    companyContactPhoneValue: partner.company?.contactPhone ?? "",
    companyDescriptionValue: partner.company?.description ?? "",
    appliesToValue: normalizePartnerAudience(
      partner.appliesTo ?? DEFAULT_PARTNER_AUDIENCE,
    ),
  };
}

export default function usePartnerCardFormState({
  partner,
  categoryId,
  focusField,
}: {
  partner: PartnerCardFormValues;
  categoryId?: string;
  focusField?: PartnerCardFormField;
}) {
  const defaults = createPartnerCardFormState(partner, categoryId);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaults.selectedCompanyId);
  const [nameValue, setNameValue] = useState(defaults.nameValue);
  const [visibilityValue, setVisibilityValue] = useState(defaults.visibilityValue);
  const [benefitVisibilityValue, setBenefitVisibilityValue] = useState(
    defaults.benefitVisibilityValue,
  );
  const [categoryValue, setCategoryValue] = useState(defaults.categoryValue);
  const [serviceModeValue, setServiceModeValue] = useState<PartnerServiceMode>(
    defaults.serviceModeValue,
  );
  const [periodStartValue, setPeriodStartValue] = useState(defaults.periodStart);
  const [periodEndValue, setPeriodEndValue] = useState(defaults.periodEnd);
  const [locationValue, setLocationValue] = useState(defaults.locationValue);
  const [mapUrlValue, setMapUrlValue] = useState(defaults.mapUrlValue);
  const [benefitActionTypeValue, setBenefitActionTypeValue] = useState(
    defaults.benefitActionTypeValue,
  );
  const [benefitActionLinkValue, setBenefitActionLinkValue] = useState(
    defaults.benefitActionLinkValue,
  );
  const [reservationLinkValue, setReservationLinkValue] = useState(
    defaults.reservationLinkValue,
  );
  const [inquiryLinkValue, setInquiryLinkValue] = useState(defaults.inquiryLinkValue);
  const [companyNameValue, setCompanyNameValue] = useState(defaults.companyNameValue);
  const [companyContactNameValue, setCompanyContactNameValue] = useState(
    defaults.companyContactNameValue,
  );
  const [companyContactEmailValue, setCompanyContactEmailValue] = useState(
    defaults.companyContactEmailValue,
  );
  const [companyContactPhoneValue, setCompanyContactPhoneValue] = useState(
    defaults.companyContactPhoneValue,
  );
  const [companyDescriptionValue, setCompanyDescriptionValue] = useState(
    defaults.companyDescriptionValue,
  );
  const [appliesToValue, setAppliesToValue] = useState<string[]>(defaults.appliesToValue);

  useEffect(() => {
    if (!focusField) {
      return;
    }
    const target = formRef.current?.querySelector<HTMLElement>(`[name="${focusField}"]`);
    target?.focus();
  }, [focusField]);

  return {
    formRef,
    periodStart: defaults.periodStart,
    periodEnd: defaults.periodEnd,
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
    setServiceModeValue: (value: PartnerServiceMode) => {
      setServiceModeValue(value);
      if (value === "online") {
        setLocationValue(ONLINE_PARTNER_LOCATION);
      } else {
        setLocationValue((current) =>
          current.trim() === ONLINE_PARTNER_LOCATION ? "" : current,
        );
      }
    },
    periodStartValue,
    setPeriodStartValue,
    periodEndValue,
    setPeriodEndValue,
    locationValue,
    setLocationValue,
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
    companyFieldsLocked: getCompanyFieldsLocked(selectedCompanyId),
  };
}
