import {
  canAdminAccessManagedCampuses,
  getManagedCampusFilterValues,
  type AdminScopeAccountLike,
} from "@/lib/admin-scope";
import { inferCampusSlugsFromLocation } from "@/lib/campuses";

type RegistrationCompanyScope = {
  managed_campus_slugs: readonly string[] | null;
};

export type AdminRegistrationScopeRow = {
  location: string | null;
  company:
    | RegistrationCompanyScope
    | readonly RegistrationCompanyScope[]
    | null;
};

export function countScopedAdminRegistrationRows(
  account: AdminScopeAccountLike,
  rows: readonly AdminRegistrationScopeRow[],
) {
  const managedCampusFilter = getManagedCampusFilterValues(account);
  if (managedCampusFilter === null) {
    return rows.length;
  }

  return rows.filter((row) => {
    const company = Array.isArray(row.company)
      ? row.company[0]
      : (row.company as RegistrationCompanyScope | null);
    const managedCampusSlugs =
      company?.managed_campus_slugs ??
      inferCampusSlugsFromLocation(row.location ?? "");

    return canAdminAccessManagedCampuses(account, [...managedCampusSlugs]);
  }).length;
}
