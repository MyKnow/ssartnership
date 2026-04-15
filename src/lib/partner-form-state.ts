export type PartnerFormField =
  | "name"
  | "categoryId"
  | "periodStart"
  | "periodEnd"
  | "location"
  | "mapUrl"
  | "reservationLink"
  | "inquiryLink"
  | "visibility"
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
