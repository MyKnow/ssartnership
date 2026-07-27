import type { AdminPushRecipientOption } from "@/lib/admin-push-recipient-search.server";
import { getAdminNotificationOverview } from "@/lib/admin-notification-ops";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type MemberFacetRow = {
  generation: number | null;
  campus: string | null;
};

type PartnerOptionRow = {
  id: string;
  name: string;
};

type ReadModelQueryResult<Row> = {
  data: Row[] | null;
  count: number | null;
  error: unknown | null;
};

function createEmptyReadModel(loadError = false) {
  return {
    members: [] as AdminPushRecipientOption[],
    memberCount: 0,
    availableYears: [] as number[],
    availableCampuses: [] as string[],
    partners: [] as Array<{ id: string; name: string }>,
    partnerCount: 0,
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
export async function getAdminPushReadModel({
  includeAudience = true,
}: {
  includeAudience?: boolean;
} = {}) {
  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return createEmptyReadModel(true);
  }

  const notificationOverviewPromise = getAdminNotificationOverview(50, 30)
    .then((value) => ({ value, failed: false as const }))
    .catch(() => ({ value: null, failed: true as const }));
  const memberFacetPromise = (includeAudience
    ? supabase
        .from("members")
        .select("generation,campus", { count: "exact" })
        .is("deleted_at", null)
    : supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)) as unknown as Promise<
    ReadModelQueryResult<MemberFacetRow>
  >;
  const partnerPromise = (includeAudience
    ? supabase
        .from("partners")
        .select("id,name", { count: "exact" })
        .order("name", { ascending: true })
    : supabase.from("partners").select("id", { count: "exact", head: true })) as unknown as Promise<
    ReadModelQueryResult<PartnerOptionRow>
  >;
  const [memberFacetResult, partnerResult, notificationOverviewResult] =
    await Promise.all([
      memberFacetPromise,
      partnerPromise,
      notificationOverviewPromise,
    ]);

  const memberFacets = includeAudience ? memberFacetResult.data ?? [] : [];
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
    partnerCount: partnerResult.count ?? (partnerResult.data ?? []).length,
    recentLogs: notificationOverview?.recentLogs ?? [],
    automaticSummaries: notificationOverview?.automaticSummaries ?? [],
    loadError: Boolean(
      memberFacetResult.error ||
        partnerResult.error ||
        notificationOverviewResult.failed,
    ),
  };
}
