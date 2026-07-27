import {
  fetchAdminDashboardHomeSnapshot,
  type AdminDashboardHomeSnapshot,
  toAdminDashboardHomeSnapshot,
} from "@/lib/partner-counts";
import type { AdminAccount } from "@/lib/admin-accounts";
import { canAdmin } from "@/lib/admin-permissions";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { withAdminReadModelTimeout } from "@/lib/admin-read-model-timeout";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const ADMIN_DASHBOARD_READ_MODEL_TIMEOUT_MS = 2_000;

export type AdminDashboardHomeData = {
  snapshot: AdminDashboardHomeSnapshot;
  hasError: boolean;
};

/**
 * Server read model for the administrator home screen.
 *
 * The route owns session and presentation concerns only. This adapter owns the
 * service-role client boundary and keeps the home page on the single snapshot
 * RPC rather than rebuilding counts in the UI layer.
 */
export async function getAdminDashboardHomeData({
  adminId,
  account,
}: {
  adminId: string;
  account: Pick<
    AdminAccount,
    "permissionId" | "permissions" | "managedCampusSlugs"
  >;
}): Promise<AdminDashboardHomeData> {
  return withAdminReadModelTimeout(
    fetchAdminDashboardHomeSnapshot(getSupabaseAdminClient(), {
      adminId,
      managedCampusSlugs: getManagedCampusFilterValues(account),
      includeBrandQueues: canAdmin(account.permissions, "brands", "read"),
      includeGraduateVerifications: canAdmin(
        account.permissions,
        "graduate_verifications",
        "read",
      ),
      includeSignupRequests: canAdmin(
        account.permissions,
        "member_signup_requests",
        "read",
      ),
      includeProfilePhotos: canAdmin(account.permissions, "profile_images", "read"),
      includeNotifications: canAdmin(account.permissions, "notifications", "read"),
    }),
    {
      snapshot: toAdminDashboardHomeSnapshot(),
      hasError: true,
    },
    ADMIN_DASHBOARD_READ_MODEL_TIMEOUT_MS,
  );
}
