export type PartnerFormField =
  | "name"
  | "categoryId"
  | "periodStart"
  | "periodEnd"
  | "location"
  | "campusSlugs"
  | "mapUrl"
  | "benefitActionType"
  | "benefitActionLink"
  | "reservationLink"
  | "inquiryLink"
  | "visibility"
  | "benefitVisibility"
  | "companyId"
  | "companyName"
  | "companyContactName"
  | "companyContactEmail"
  | "companyContactPhone"
  | "companyDescription"
  | "appliesTo";

export type PartnerCreateFormState = {
  status: "idle" | "error";
  errorCode?: string | null;
};

export const PARTNER_CREATE_FORM_INITIAL_STATE: PartnerCreateFormState = {
  status: "idle",
  errorCode: null,
};
