import {
  listPartnerChangeRequestPage,
  listPartnerChangeRequests,
  type PartnerChangeRequestPage,
} from "@/lib/partner-change-requests";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function emptyPartnerChangeRequestPage(page: number, pageSize: number): PartnerChangeRequestPage {
  return {
    requests: [],
    totalCount: 0,
    page,
    pageSize,
  };
}

async function resolveScopedPartnerIds(
  managedCampusSlugs: readonly string[] | null,
): Promise<string[] | undefined> {
  if (managedCampusSlugs === null) {
    return undefined;
  }

  if (managedCampusSlugs.length === 0) {
    return [];
  }

  if (isPartnerPortalMock) {
    const requests = await listPartnerChangeRequests();
    return [
      ...new Set(
        requests
          .filter((request) =>
            request.currentCampusSlugs.some((slug) => managedCampusSlugs.includes(slug)),
          )
          .map((request) => request.partnerId),
      ),
    ];
  }

  const partnersResult = await getSupabaseAdminClient()
    .from("partners")
    .select("id")
    .overlaps("managed_campus_slugs", [...managedCampusSlugs]);

  if (partnersResult.error) {
    throw partnersResult.error;
  }

  return (partnersResult.data ?? []).map((partner) => partner.id);
}

/**
 * Read model for the pending partner-change review queue.
 *
 * The route supplies only the trusted admin scope and sanitized pagination.
 * This keeps storage-specific regional filtering, mock parity, and safe error
 * recovery out of the route component.
 */
export async function getAdminPartnerChangeRequestQueueReadModel({
  managedCampusSlugs,
  page,
  pageSize,
}: {
  managedCampusSlugs: readonly string[] | null;
  page: number;
  pageSize: number;
}) {
  const emptyPage = emptyPartnerChangeRequestPage(page, pageSize);

  try {
    const partnerIds = await resolveScopedPartnerIds(managedCampusSlugs);
    const requestPage = await listPartnerChangeRequestPage({
      partnerIds,
      page,
      pageSize,
    });

    return {
      requestPage,
      queueLoadError: false,
    };
  } catch {
    return {
      requestPage: emptyPage,
      queueLoadError: true,
    };
  }
}
