import type { AdminPushRecipientOption } from "@/lib/admin-push-recipient-search.server";
import { getAdminNotificationOverview } from "@/lib/admin-notification-ops";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function createEmptyReadModel(loadError = false) {
  return {
    members: [] as AdminPushRecipientOption[],
    memberCount: 0,
    availableYears: [] as number[],
    availableCampuses: [] as string[],
    partners: [] as Array<{ id: string; name: string }>,
    recentLogs: [],
    automaticSummaries: [],
    loadError,
  };
}

/**
 * Initial data for the admin push workspace.
 *
 * The browser receives only recipient facets. Personal recipient rows are
 * fetched on demand through the permission-checked search endpoint.
 */
export async function getAdminPushReadModel() {
  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return createEmptyReadModel(true);
  }

  const notificationOverviewPromise = getAdminNotificationOverview(50, 30)
    .then((value) => ({ value, failed: false as const }))
    .catch(() => ({ value: null, failed: true as const }));
  const [memberFacetResult, partnerResult, notificationOverviewResult] =
    await Promise.all([
      supabase
        .from("members")
        .select("generation,campus", { count: "exact" })
        .is("deleted_at", null),
      supabase.from("partners").select("id,name").order("name", { ascending: true }),
      notificationOverviewPromise,
    ]);

  const memberFacets = memberFacetResult.data ?? [];
  const availableYears = Array.from(
    new Set(
      memberFacets
        .map((member) => member.generation)
        .filter((generation): generation is number => Number.isInteger(generation)),
    ),
  ).sort((left, right) => right - left);
  const availableCampuses = Array.from(
    new Set(
      memberFacets
        .map((member) => member.campus?.trim())
        .filter((campus): campus is string => Boolean(campus)),
    ),
  ).sort((left, right) => left.localeCompare(right, "ko-KR"));
  const notificationOverview = notificationOverviewResult.value;

  return {
    members: [] as AdminPushRecipientOption[],
    memberCount: memberFacetResult.count ?? memberFacets.length,
    availableYears,
    availableCampuses,
    partners: partnerResult.data ?? [],
    recentLogs: notificationOverview?.recentLogs ?? [],
    automaticSummaries: notificationOverview?.automaticSummaries ?? [],
    loadError: Boolean(
      memberFacetResult.error ||
        partnerResult.error ||
        notificationOverviewResult.failed,
    ),
  };
}
