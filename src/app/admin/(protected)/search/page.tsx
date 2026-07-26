import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminGlobalSearchResultsView from "@/components/admin/AdminGlobalSearchResultsView";
import { AdminGlobalSearchSkeletonContent } from "@/components/loading/AdminGlobalSearchSkeletonContent";
import { requireAdminPageAccess } from "@/lib/admin-access";
import {
  buildAdminGlobalSearchHref,
  normalizeAdminGlobalSearchQuery,
} from "@/lib/admin-global-search";
import { searchAdminGlobalEntities } from "@/lib/admin-global-search.server";
import { canAdmin } from "@/lib/admin-permissions";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AdminGlobalSearchParams = {
  q?: string | string[];
};

function getFirstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function AdminGlobalSearchContent({
  adminSession,
  query,
}: {
  adminSession: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>;
  query: string;
}) {
  const canSearchMembers = canAdmin(adminSession.account.permissions, "members", "read");
  const canSearchPartners = canAdmin(adminSession.account.permissions, "brands", "read");
  const { members, partners, memberSearchFailed, partnerSearchFailed } =
    await searchAdminGlobalEntities({
      query,
      canSearchMembers,
      canSearchPartners,
      managedCampusSlugs: getManagedCampusFilterValues(adminSession.account),
    });

  return (
    <AdminGlobalSearchResultsView
        query={query}
        members={members}
        partners={partners}
        canSearchMembers={canSearchMembers}
        canSearchPartners={canSearchPartners}
        memberSearchFailed={memberSearchFailed}
        partnerSearchFailed={partnerSearchFailed}
    />
  );
}

export default async function AdminGlobalSearchPage({
  searchParams,
}: {
  searchParams?: Promise<AdminGlobalSearchParams>;
}) {
  const query = normalizeAdminGlobalSearchQuery(
    getFirstSearchValue((await searchParams)?.q),
  );
  const searchPath = buildAdminGlobalSearchHref(query);
  let adminSession = await getAdminSession();
  if (!adminSession) {
    await requireAdminPageAccess(searchPath);
    adminSession = await getAdminSession();
  }

  if (!adminSession) {
    return null;
  }

  return (
    <AdminShell title="통합 검색">
      <Suspense fallback={<AdminGlobalSearchSkeletonContent />}>
        <AdminGlobalSearchContent adminSession={adminSession} query={query} />
      </Suspense>
    </AdminShell>
  );
}
