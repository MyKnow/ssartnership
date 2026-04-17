import { redirect } from "next/navigation";
import {
  parseCategoryPayload,
  parsePartnerCompanyPayload,
  parsePartnerPayload,
  parseSsafyCycleSettingsPayload,
} from "./shared-parsers.ts";

export function parsePartnerPayloadOrRedirect(
  formData: FormData,
  path: string,
): ReturnType<typeof parsePartnerPayload> {
  try {
    return parsePartnerPayload(formData);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "partner_form_invalid_request";
    redirect(`${path}?error=${encodeURIComponent(code)}`);
  }
}

export function parsePartnerCompanyPayloadOrRedirect(
  formData: FormData,
  path: string,
): ReturnType<typeof parsePartnerCompanyPayload> {
  try {
    return parsePartnerCompanyPayload(formData);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "partner_company_invalid_request";
    redirect(`${path}?error=${encodeURIComponent(code)}`);
  }
}

export function parseCategoryPayloadOrRedirect(
  formData: FormData,
  path: string,
) {
  try {
    return parseCategoryPayload(formData);
  } catch (error) {
    const code = error instanceof Error ? error.message : "category_invalid_request";
    redirect(`${path}?error=${encodeURIComponent(code)}`);
  }
}

export function parseSsafyCycleSettingsPayloadOrRedirect(
  formData: FormData,
  path: string,
) {
  try {
    return parseSsafyCycleSettingsPayload(formData);
  } catch (error) {
    const code = error instanceof Error ? error.message : "cycle_invalid_request";
    redirect(`${path}?error=${encodeURIComponent(code)}`);
  }
}
