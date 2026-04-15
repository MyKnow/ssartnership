import type {
  PartnerPortalCompanySummary,
  PartnerPortalLoginResult,
} from "../partner-portal.ts";
import { normalizePartnerVisibility } from "../partner-visibility.ts";
import type {
  PartnerPortalAccountRow,
  PartnerPortalSetupCompanyRow,
  PartnerPortalSetupServiceRow,
} from "./types.ts";

export function toPartnerPortalAccountSummary(
  account: PartnerPortalAccountRow,
  overrides?: Partial<PartnerPortalLoginResult["account"]>,
) {
  return {
    id: account.id,
    loginId: account.login_id,
    displayName: account.display_name,
    email: account.email ?? account.login_id,
    mustChangePassword: Boolean(account.must_change_password),
    emailVerifiedAt: account.email_verified_at ?? null,
    initialSetupCompletedAt: account.initial_setup_completed_at ?? null,
    isActive: Boolean(account.is_active),
    ...overrides,
  };
}

export function extractPartnerPortalCategoryLabel(
  categories: PartnerPortalSetupServiceRow["categories"],
) {
  if (!categories) {
    return "제휴";
  }
  if (Array.isArray(categories)) {
    return categories[0]?.label ?? "제휴";
  }
  return categories.label ?? "제휴";
}

export function toPartnerPortalSetupCompanySummary(
  company: PartnerPortalSetupCompanyRow,
  services: PartnerPortalSetupServiceRow[],
): PartnerPortalCompanySummary {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description ?? null,
    contactName: company.contact_name ?? null,
    contactEmail: company.contact_email ?? null,
    contactPhone: company.contact_phone ?? null,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      location: service.location,
      categoryLabel: extractPartnerPortalCategoryLabel(service.categories),
      visibility: normalizePartnerVisibility(service.visibility),
    })),
  };
}
