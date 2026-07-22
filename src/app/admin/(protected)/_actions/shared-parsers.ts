import { validateFormCampusSlugSelection } from "../../../../lib/campuses.ts";
import {
  isPartnerVisibility,
  normalizePartnerVisibility,
} from "../../../../lib/partner-visibility.ts";
import { parsePartnerAudienceSelection } from "../../../../lib/partner-audience.ts";
import {
  isPartnerBenefitVisibility,
  normalizePartnerBenefitVisibility,
} from "../../../../lib/partner-benefit-visibility.ts";
import {
  isPartnerBenefitActionType,
  normalizePartnerBenefitActionType,
} from "../../../../lib/partner-benefit-action.ts";
import { normalizePartnerDetailDescription } from "../../../../lib/partner-detail-description.ts";
import {
  normalizePartnerBenefitItems,
  partnerBenefitItemsToTitles,
} from "../../../../lib/partner-benefit-items.ts";
import { normalizePartnerLoginId } from "../../../../lib/partner-utils.ts";
import {
  ONLINE_PARTNER_LOCATION,
  getPartnerServiceMode,
  type PartnerServiceMode,
} from "../../../../lib/partner-service-mode.ts";
import {
  isValidEmail,
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateCategoryKey,
  validateDateRange,
} from "../../../../lib/validation.ts";
import type {
  PartnerAccountCreateInput,
  PartnerCompanyCrudInput,
  PartnerCompanyInput,
  PartnerCoreInput,
} from "./shared-types.ts";

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parsePartnerBenefitItems(formData: FormData, legacyBenefits: string) {
  const rawItems = formData.get("benefitItems");
  if (typeof rawItems === "string" && rawItems.trim()) {
    return normalizePartnerBenefitItems(JSON.parse(rawItems));
  }
  return normalizePartnerBenefitItems(
    parseList(legacyBenefits).map((title, index) => ({ id: `legacy-benefit-${index + 1}`, title })),
  );
}

function parseOptionalUrl(value: string) {
  return sanitizeHttpUrl(value) ?? null;
}

function parsePartnerLink(value: string) {
  return sanitizePartnerLinkValue(value) ?? null;
}

export function parsePartnerCompanyPayload(
  formData: FormData,
): PartnerCompanyInput {
  const companyId = String(formData.get("companyId") || "").trim();
  const name = String(formData.get("companyName") || "").trim();
  const description = String(formData.get("companyDescription") || "").trim();
  const contactName = String(formData.get("companyContactName") || "").trim();
  const contactEmail = String(formData.get("companyContactEmail") || "").trim();
  const contactPhone = String(formData.get("companyContactPhone") || "").trim();

  if (!companyId && contactEmail && !isValidEmail(contactEmail)) {
    throw new Error("partner_account_invalid_email");
  }

  return {
    companyId: companyId || null,
    name,
    description: description || null,
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
  };
}

export function parsePartnerCompanyCrudPayload(
  formData: FormData,
): PartnerCompanyCrudInput {
  const companyId = String(formData.get("companyId") || "").trim();
  const name = String(formData.get("companyName") || "").trim();
  const description = String(formData.get("companyDescription") || "").trim();
  const isActive = formData.getAll("companyIsActive").includes("true");

  if (!name) {
    throw new Error("partner_company_missing_name");
  }

  return {
    companyId: companyId || null,
    name,
    description: description || null,
    isActive,
  };
}

export function parsePartnerAccountPayload(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const loginId = normalizePartnerLoginId(String(formData.get("loginId") || "").trim());
  const displayName = String(formData.get("displayName") || "").trim();
  const isActive = formData.getAll("isActive").includes("true");
  const mustChangePassword = formData.getAll("mustChangePassword").includes("true");

  if (!id) {
    throw new Error("partner_account_missing_id");
  }
  if (!loginId) {
    throw new Error("partner_account_invalid_request");
  }
  if (!isValidEmail(loginId)) {
    throw new Error("partner_account_invalid_email");
  }
  if (!displayName) {
    throw new Error("partner_account_invalid_request");
  }

  return {
    id,
    loginId,
    displayName,
    isActive,
    mustChangePassword,
  };
}

export function parsePartnerAccountCreatePayload(
  formData: FormData,
): PartnerAccountCreateInput {
  const loginId = normalizePartnerLoginId(
    String(formData.get("loginId") || "").trim(),
  );
  const displayName = String(formData.get("displayName") || "").trim();
  const companyId = String(formData.get("companyId") || "").trim();
  const isActive = formData.getAll("isActive").includes("true");

  if (!loginId || !displayName) {
    throw new Error("partner_account_invalid_request");
  }
  if (!isValidEmail(loginId)) {
    throw new Error("partner_account_invalid_email");
  }
  if (!companyId) {
    throw new Error("partner_account_company_missing");
  }

  return {
    loginId,
    displayName,
    companyId,
    isActive,
  };
}

export function parsePartnerAccountCompanyPayload(formData: FormData) {
  const accountId = String(formData.get("accountId") || "").trim();
  const companyId = String(formData.get("companyId") || "").trim();
  const isActive = formData.getAll("isActive").includes("true");

  if (!accountId || !companyId) {
    throw new Error("partner_account_company_missing");
  }

  return {
    accountId,
    companyId,
    isActive,
  };
}

export function parseCategoryPayload(formData: FormData) {
  const key = String(formData.get("key") || "")
    .trim()
    .toLowerCase();
  const label = String(formData.get("label") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const rawColor = String(formData.get("color") || "").trim();

  if (!key || !label) {
    throw new Error("category_missing_fields");
  }

  const keyError = validateCategoryKey(key);
  if (keyError) {
    throw new Error("category_invalid_key");
  }

  const color = rawColor ? sanitizeHexColor(rawColor) : null;
  if (rawColor && !color) {
    throw new Error("category_invalid_color");
  }

  return {
    key,
    label,
    description,
    color,
  };
}

function parseSsafyCycleNumber(
  value: string,
  _label: string,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error("cycle_invalid_number");
  }
  return parsed;
}

export function parseSsafyCycleSettingsPayload(formData: FormData) {
  const anchorYearRaw = String(formData.get("anchorYear") || "").trim();
  const anchorCalendarYearRaw = String(formData.get("anchorCalendarYear") || "").trim();
  const anchorMonthRaw = String(formData.get("anchorMonth") || "").trim();

  if (!anchorYearRaw || !anchorCalendarYearRaw || !anchorMonthRaw) {
    throw new Error("cycle_missing_fields");
  }

  return {
    anchorYear: parseSsafyCycleNumber(anchorYearRaw, "기준 기수", 1, 99),
    anchorCalendarYear: parseSsafyCycleNumber(
      anchorCalendarYearRaw,
      "기준 연도",
      2000,
      3000,
    ),
    anchorMonth: parseSsafyCycleNumber(anchorMonthRaw, "기준 월", 1, 12),
  };
}

export function parsePartnerPayload(formData: FormData): PartnerCoreInput {
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const rawLocation = String(formData.get("location") || "").trim();
  const rawServiceMode = String(formData.get("serviceMode") || "").trim();
  let serviceMode: PartnerServiceMode;
  if (!rawServiceMode) {
    serviceMode = getPartnerServiceMode(rawLocation);
  } else if (rawServiceMode === "offline" || rawServiceMode === "online") {
    serviceMode = rawServiceMode;
  } else {
    throw new Error("partner_form_invalid_service_mode");
  }
  const location =
    serviceMode === "online"
      ? ONLINE_PARTNER_LOCATION
      : rawLocation === ONLINE_PARTNER_LOCATION
        ? ""
        : rawLocation;
  const detailDescription = normalizePartnerDetailDescription(
    formData.get("detailDescription"),
  );
  const rawMapUrl = String(formData.get("mapUrl") || "").trim();
  const rawBenefitActionType = String(formData.get("benefitActionType") || "").trim();
  const rawBenefitActionLink = String(formData.get("benefitActionLink") || "").trim();
  const rawBenefitVerificationPin = String(
    formData.get("benefitVerificationPin") || "",
  ).trim();
  const rawReservationLink = String(formData.get("reservationLink") || "").trim();
  const rawInquiryLink = String(formData.get("inquiryLink") || "").trim();
  const rawVisibility = String(formData.get("visibility") || "").trim();
  const rawBenefitVisibility = String(formData.get("benefitVisibility") || "").trim();
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();
  const conditions = String(formData.get("conditions") || "").trim();
  const benefits = String(formData.get("benefits") || "").trim();
  const tags = String(formData.get("tags") || "").trim();
  const appliesTo = formData.getAll("appliesTo").map((item) => String(item).trim());
  const campusSlugSelection = validateFormCampusSlugSelection(
    formData.getAll("campusSlugs").map((item) => String(item).trim()),
    location,
  );
  const campusSlugs = campusSlugSelection.campusSlugs;

  if (!name) {
    throw new Error("partner_form_missing_name");
  }
  if (!categoryId) {
    throw new Error("partner_form_missing_category");
  }
  if (!location) {
    throw new Error("partner_form_missing_location");
  }

  if (validateDateRange(periodStart, periodEnd)) {
    throw new Error("partner_form_invalid_period");
  }

  const mapUrl = parseOptionalUrl(rawMapUrl);
  if (rawMapUrl && !mapUrl) {
    throw new Error("partner_form_invalid_map_url");
  }

  if (rawBenefitActionType && !isPartnerBenefitActionType(rawBenefitActionType)) {
    throw new Error("partner_form_invalid_benefit_action_type");
  }
  const benefitActionType = normalizePartnerBenefitActionType(
    rawBenefitActionType,
    rawBenefitActionLink || rawReservationLink ? "external_link" : "none",
  );
  const parsedBenefitActionLink = parsePartnerLink(
    rawBenefitActionLink || rawReservationLink,
  );
  if (benefitActionType === "external_link" && !parsedBenefitActionLink) {
    throw new Error("partner_form_invalid_benefit_action_link");
  }
  if (
    benefitActionType !== "external_link" &&
    rawBenefitActionLink &&
    !parsePartnerLink(rawBenefitActionLink)
  ) {
    throw new Error("partner_form_invalid_benefit_action_link");
  }
  const benefitActionLink =
    benefitActionType === "external_link" ? parsedBenefitActionLink : null;
  const reservationLink = benefitActionLink;

  if (rawBenefitVerificationPin && !/^\d{4}$/.test(rawBenefitVerificationPin)) {
    throw new Error("partner_form_invalid_benefit_verification_pin");
  }
  const benefitVerificationPin = rawBenefitVerificationPin || null;
  let benefitItems;
  try {
    benefitItems = parsePartnerBenefitItems(formData, benefits);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("partner_form_invalid_benefit_items");
    }
    throw error;
  }

  const inquiryLink = parsePartnerLink(rawInquiryLink);
  if (rawInquiryLink && !inquiryLink) {
    throw new Error("partner_form_invalid_inquiry_url");
  }

  if (rawVisibility && !isPartnerVisibility(rawVisibility)) {
    throw new Error("partner_form_invalid_visibility");
  }
  if (rawBenefitVisibility && !isPartnerBenefitVisibility(rawBenefitVisibility)) {
    throw new Error("partner_form_invalid_benefit_visibility");
  }

  const parsedAppliesTo = parsePartnerAudienceSelection(appliesTo);
  if (!parsedAppliesTo) {
    throw new Error("partner_form_invalid_applies_to");
  }
  if (!campusSlugSelection.ok) {
    throw new Error("partner_form_invalid_campus_slugs");
  }

  return {
    name,
    categoryId,
    serviceMode,
    location,
    detailDescription,
    campusSlugs,
    mapUrl,
    benefitActionType,
    benefitActionLink,
    benefitVerificationPin,
    reservationLink,
    inquiryLink,
    periodStart: periodStart || null,
    periodEnd: periodEnd || null,
    conditions: parseList(conditions),
    benefits: partnerBenefitItemsToTitles(benefitItems),
    benefitItems,
    appliesTo: parsedAppliesTo,
    tags: parseList(tags),
    visibility: normalizePartnerVisibility(rawVisibility || "public"),
    benefitVisibility: normalizePartnerBenefitVisibility(
      rawBenefitVisibility || "public",
    ),
  };
}
