export const PARTNER_DETAIL_DESCRIPTION_MAX_LENGTH = 1200;

export function normalizePartnerDetailDescription(
  value: FormDataEntryValue | string | null | undefined,
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  if (text.length > PARTNER_DETAIL_DESCRIPTION_MAX_LENGTH) {
    throw new Error("partner_form_invalid_detail_description");
  }
  return text;
}

export function isPartnerDetailDescriptionValid(
  value: string | null | undefined,
) {
  return (value ?? "").trim().length <= PARTNER_DETAIL_DESCRIPTION_MAX_LENGTH;
}
