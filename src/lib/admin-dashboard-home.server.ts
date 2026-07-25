import {
  fetchAdminDashboardHomeSnapshot,
  type AdminDashboardHomeSnapshot,
} from "@/lib/partner-counts";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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
  managedCampusSlugs,
}: {
  adminId: string;
  managedCampusSlugs: readonly string[] | null;
}): Promise<AdminDashboardHomeData> {
  return fetchAdminDashboardHomeSnapshot(getSupabaseAdminClient(), {
    adminId,
    managedCampusSlugs,
  });
}
