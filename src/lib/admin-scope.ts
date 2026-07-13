import {
  type AdminPermissionTemplateKey,
} from "@/lib/admin-permissions";
import {
  type CampusSlug,
  CAMPUS_SLUGS,
  normalizeCampusSlugs,
} from "@/lib/campuses";

export const REGIONAL_ADMIN_PERMISSION_KEY = "regional_partner_manager";

export type AdminScopeAccountLike = {
  permissionId?: string | null;
  managedCampusSlugs?: string[] | null;
};

export function isRegionalAdminPermission(
  permissionId: string | null | undefined,
) {
  return permissionId === REGIONAL_ADMIN_PERMISSION_KEY;
}

export function normalizeAdminManagedCampusSlugs(values: string[] | null | undefined) {
  return normalizeCampusSlugs(values ?? []);
}

export function isRegionalAdminAccount(account: AdminScopeAccountLike | null | undefined) {
  return isRegionalAdminPermission(account?.permissionId);
}

export function canAdminAccessManagedCampuses(
  account: AdminScopeAccountLike,
  managedCampusSlugs: string[] | null | undefined,
) {
  if (!isRegionalAdminAccount(account)) {
    return true;
  }

  const accountSlugs = normalizeAdminManagedCampusSlugs(account.managedCampusSlugs);
  const targetSlugs = normalizeAdminManagedCampusSlugs(managedCampusSlugs);
  if (accountSlugs.length === 0 || targetSlugs.length === 0) {
    return false;
  }

  return targetSlugs.some((slug) => accountSlugs.includes(slug));
}

export function canAdminMutateGlobalPartnerAccount(
  account: AdminScopeAccountLike,
  linkedCompanyManagedCampusSlugs: Array<string[] | null | undefined>,
) {
  if (!isRegionalAdminAccount(account)) {
    return true;
  }

  if (linkedCompanyManagedCampusSlugs.length === 0) {
    return false;
  }

  return linkedCompanyManagedCampusSlugs.every((managedCampusSlugs) =>
    canAdminAccessManagedCampuses(account, managedCampusSlugs),
  );
}

export function resolveCreatedManagedCampusSlugs(
  account: AdminScopeAccountLike,
  requestedManagedCampusSlugs: string[] | null | undefined,
) {
  if (isRegionalAdminAccount(account)) {
    return normalizeAdminManagedCampusSlugs(account.managedCampusSlugs);
  }
  const normalized = normalizeAdminManagedCampusSlugs(requestedManagedCampusSlugs);
  return normalized.length > 0 ? normalized : [...CAMPUS_SLUGS];
}

export function getDefaultManagedCampusSlugsForTemplate(
  templateKey: AdminPermissionTemplateKey | string,
  requestedManagedCampusSlugs: string[] | null | undefined,
) {
  return isRegionalAdminPermission(templateKey)
    ? normalizeAdminManagedCampusSlugs(requestedManagedCampusSlugs)
    : [];
}

export function getManagedCampusFilterValues(account: AdminScopeAccountLike) {
  return isRegionalAdminAccount(account)
    ? normalizeAdminManagedCampusSlugs(account.managedCampusSlugs)
    : null;
}

export function assertAdminCanAccessManagedCampuses(
  account: AdminScopeAccountLike,
  managedCampusSlugs: string[] | null | undefined,
) {
  if (!canAdminAccessManagedCampuses(account, managedCampusSlugs)) {
    throw new Error("regional_admin_scope_denied");
  }
}

export function assertAdminCanUseGlobalFeature(account: AdminScopeAccountLike) {
  if (isRegionalAdminAccount(account)) {
    throw new Error("admin_global_scope_required");
  }
}

export type RegionalManagedCampusSlug = CampusSlug;
