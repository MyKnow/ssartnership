import {
  parseCohortCardThemeDeletePayload,
  parseCohortCardThemePayload,
} from "@/lib/cohort-card-themes";
import { getSafeAdminActionErrorCode } from "@/lib/admin-action-errors";
import {
  parseCategoryPayload,
  parsePartnerCompanyPayload,
  parsePartnerPayload,
  parseSsafyCycleSettingsPayload,
} from "./shared-parsers.ts";
import { redirectAdminActionError } from "./shared-helpers";

export function parsePartnerPayloadOrRedirect(
  formData: FormData,
  path: string,
): ReturnType<typeof parsePartnerPayload> {
  try {
    return parsePartnerPayload(formData);
  } catch (error) {
    const code = getSafeAdminActionErrorCode(error, "partner_form_invalid_request");
    redirectAdminActionError(path, code);
  }
}

export function parsePartnerCompanyPayloadOrRedirect(
  formData: FormData,
  path: string,
): ReturnType<typeof parsePartnerCompanyPayload> {
  try {
    return parsePartnerCompanyPayload(formData);
  } catch (error) {
    const code = getSafeAdminActionErrorCode(error, "partner_company_invalid_request");
    redirectAdminActionError(path, code);
  }
}

export function parseCategoryPayloadOrRedirect(
  formData: FormData,
  path: string,
) {
  try {
    return parseCategoryPayload(formData);
  } catch (error) {
    const code = getSafeAdminActionErrorCode(error, "category_invalid_request");
    redirectAdminActionError(path, code);
  }
}

export function parseSsafyCycleSettingsPayloadOrRedirect(
  formData: FormData,
  path: string,
) {
  try {
    return parseSsafyCycleSettingsPayload(formData);
  } catch (error) {
    const code = getSafeAdminActionErrorCode(error, "cycle_invalid_request");
    redirectAdminActionError(path, code);
  }
}

export function parseCohortCardThemePayloadOrRedirect(
  formData: FormData,
  path: string,
) {
  try {
    return parseCohortCardThemePayload(formData);
  } catch (error) {
    const code = getSafeAdminActionErrorCode(error, "cohort_theme_invalid_request");
    redirectAdminActionError(path, code);
  }
}

export function parseCohortCardThemeDeletePayloadOrRedirect(
  formData: FormData,
  path: string,
) {
  try {
    return parseCohortCardThemeDeletePayload(formData);
  } catch (error) {
    const code = getSafeAdminActionErrorCode(error, "cohort_theme_invalid_request");
    redirectAdminActionError(path, code);
  }
}
