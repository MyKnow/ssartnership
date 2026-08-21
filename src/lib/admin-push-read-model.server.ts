import type { AdminPushRecipientOption } from "@/lib/admin-push-recipient-search.server";
import { getAdminNotificationOverview } from "@/lib/admin-notification-ops";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";

const ADMIN_PUSH_READ_MODEL_CACHE_REVALIDATE_SECONDS = 3;
const ADMIN_PUSH_AUDIENCE_FACETS_CACHE_TAG = "admin-push-audience-facets";
const ADMIN_PUSH_NOTIFICATION_OVERVIEW_CACHE_TAG =
  "admin-push-notification-overview";

type MemberFacetRow = {
  generation: number | null;
  campus: string | null;
};

type PartnerOptionRow = {
  id: string;
  name: string;
};

type AdminPushAudienceFacetsPayload = {
  memberCount?: number | string | null;
  availableYears?: unknown;
  availableCampuses?: unknown;
  partners?: unknown;
  partnerCount?: number | string | null;
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

function parseCount(
  value: number | string | null | undefined,
  fallback: number,
): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function normalizeYears(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? Number(item) : item))
        .filter((item): item is number => Number.isInteger(item)),
    ),
  ).sort((left, right) => right - left);
}

function normalizeCampuses(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "ko-KR"));
}

function normalizePartners(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ id: string; name: string }>;
  }
  return value.filter(
    (item): item is PartnerOptionRow =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as PartnerOptionRow).id === "string" &&
      typeof (item as PartnerOptionRow).name === "string",
  );
}

async function loadAdminPushAudienceFacets(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase.rpc("get_admin_push_audience_facets");
  if (!error) {
    const payload = (data ?? {}) as AdminPushAudienceFacetsPayload;
    const partners = normalizePartners(payload.partners);
    return {
      members: [] as AdminPushRecipientOption[],
      memberCount: parseCount(payload.memberCount, 0),
      availableYears: normalizeYears(payload.availableYears),
      availableCampuses: normalizeCampuses(payload.availableCampuses),
      partners,
      partnerCount: parseCount(payload.partnerCount, partners.length),
      failed: false,
    };
  }

  // Keep the old read path during rolling deploys before the RPC exists in
  // the target database. The fallback is also useful for local development.
  const [memberResult, partnerResult] = await Promise.all([
    supabase
      .from("members")
      .select("generation,campus", { count: "exact" })
      .is("deleted_at", null),
    supabase
      .from("partners")
      .select("id,name", { count: "exact" })
      .order("name", { ascending: true }),
  ]);
  const memberFacets = (memberResult.data ?? []) as MemberFacetRow[];
  const partners = (partnerResult.data ?? []) as PartnerOptionRow[];

  return {
    members: [] as AdminPushRecipientOption[],
    memberCount: memberResult.count ?? memberFacets.length,
    availableYears: normalizeYears(memberFacets.map((member) => member.generation)),
    availableCampuses: normalizeCampuses(memberFacets.map((member) => member.campus)),
    partners,
    partnerCount: partnerResult.count ?? partners.length,
    failed: Boolean(memberResult.error || partnerResult.error),
  };
}

async function loadAdminPushAudienceSummary(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const [memberResult, partnerResult] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase.from("partners").select("id", { count: "exact", head: true }),
  ]);

  return {
    members: [] as AdminPushRecipientOption[],
    memberCount: memberResult.count ?? 0,
    availableYears: [] as number[],
    availableCampuses: [] as string[],
    partners: [] as Array<{ id: string; name: string }>,
    partnerCount: partnerResult.count ?? 0,
    failed: Boolean(memberResult.error || partnerResult.error),
  };
}

const getCachedAdminPushAudienceFacets = unstable_cache(
  () => loadAdminPushAudienceFacets(getSupabaseAdminClient()),
  [ADMIN_PUSH_AUDIENCE_FACETS_CACHE_TAG, "facets"],
  {
    revalidate: ADMIN_PUSH_READ_MODEL_CACHE_REVALIDATE_SECONDS,
    tags: [ADMIN_PUSH_AUDIENCE_FACETS_CACHE_TAG],
  },
);

const getCachedAdminPushAudienceSummary = unstable_cache(
  () => loadAdminPushAudienceSummary(getSupabaseAdminClient()),
  [ADMIN_PUSH_AUDIENCE_FACETS_CACHE_TAG, "summary"],
  {
    revalidate: ADMIN_PUSH_READ_MODEL_CACHE_REVALIDATE_SECONDS,
    tags: [ADMIN_PUSH_AUDIENCE_FACETS_CACHE_TAG],
  },
);

const getCachedAdminNotificationOverview = unstable_cache(
  () => getAdminNotificationOverview(50, 30),
  [ADMIN_PUSH_NOTIFICATION_OVERVIEW_CACHE_TAG],
  {
    revalidate: ADMIN_PUSH_READ_MODEL_CACHE_REVALIDATE_SECONDS,
    tags: [ADMIN_PUSH_NOTIFICATION_OVERVIEW_CACHE_TAG],
  },
);

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
  try {
    getSupabaseAdminClient();
  } catch {
    return createEmptyReadModel(true);
  }

  const notificationOverviewPromise = getCachedAdminNotificationOverview()
    .then((value) => ({ value, failed: false as const }))
    .catch(() => ({ value: null, failed: true as const }));
  const audiencePromise = includeAudience
    ? getCachedAdminPushAudienceFacets()
    : getCachedAdminPushAudienceSummary();
  const [audience, notificationOverviewResult] =
    await Promise.all([
      audiencePromise,
      notificationOverviewPromise,
    ]);
  const notificationOverview = notificationOverviewResult.value;

  return {
    members: audience.members,
    memberCount: audience.memberCount,
    availableYears: audience.availableYears,
    availableCampuses: audience.availableCampuses,
    partners: audience.partners,
    partnerCount: audience.partnerCount,
    recentLogs: notificationOverview?.recentLogs ?? [],
    automaticSummaries: notificationOverview?.automaticSummaries ?? [],
    loadError: Boolean(
      audience.failed || notificationOverviewResult.failed,
    ),
  };
}
