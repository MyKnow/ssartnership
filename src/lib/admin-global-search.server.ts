import {
  getAdminGlobalSearchLikePattern,
  isAdminGlobalSearchQueryReady,
  type AdminGlobalSearchMember,
  type AdminGlobalSearchPartner,
} from "@/lib/admin-global-search";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const SEARCH_RESULT_LIMIT = 8;

type AdminGlobalSearchMemberRow = {
  id: string;
  display_name: string | null;
  manual_login_id: string | null;
  generation: number | null;
  campus: string | null;
};

type AdminGlobalSearchPartnerRow = {
  id: string;
  name: string;
  location: string | null;
  campus_slugs: string[] | null;
};

export type AdminGlobalSearchResult = {
  members: AdminGlobalSearchMember[];
  partners: AdminGlobalSearchPartner[];
  memberSearchFailed: boolean;
  partnerSearchFailed: boolean;
};

function emptyAdminGlobalSearchResult(): AdminGlobalSearchResult {
  return {
    members: [],
    partners: [],
    memberSearchFailed: false,
    partnerSearchFailed: false,
  };
}

function dedupeMembers(rows: AdminGlobalSearchMember[]) {
  const found = new Map<string, AdminGlobalSearchMember>();
  rows.forEach((member) => found.set(member.id, member));
  return Array.from(found.values()).slice(0, SEARCH_RESULT_LIMIT);
}

function dedupePartners(rows: AdminGlobalSearchPartner[]) {
  const found = new Map<string, AdminGlobalSearchPartner>();
  rows.forEach((partner) => found.set(partner.id, partner));
  return Array.from(found.values()).slice(0, SEARCH_RESULT_LIMIT);
}

export async function searchAdminGlobalEntities({
  query,
  canSearchMembers,
  canSearchPartners,
  managedCampusSlugs,
}: {
  query: string;
  canSearchMembers: boolean;
  canSearchPartners: boolean;
  managedCampusSlugs: readonly string[] | null;
}): Promise<AdminGlobalSearchResult> {
  if (
    !isAdminGlobalSearchQueryReady(query) ||
    (!canSearchMembers && !canSearchPartners)
  ) {
    return emptyAdminGlobalSearchResult();
  }

  const supabase = getSupabaseAdminClient();
  const normalizedQuery = query.trim();
  const pattern = getAdminGlobalSearchLikePattern(normalizedQuery);
  const isIdentifierQuery = isUuid(normalizedQuery);
  const memberQueries = canSearchMembers
    ? [
        supabase
          .from("members")
          .select("id,display_name,manual_login_id,generation,campus")
          .is("deleted_at", null)
          .ilike("display_name", pattern)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("members")
          .select("id,display_name,manual_login_id,generation,campus")
          .is("deleted_at", null)
          .ilike("manual_login_id", pattern)
          .order("updated_at", { ascending: false })
          .limit(8),
        ...(isIdentifierQuery
          ? [
              supabase
                .from("members")
                .select("id,display_name,manual_login_id,generation,campus")
                .is("deleted_at", null)
                .eq("id", normalizedQuery)
                .limit(1),
            ]
          : []),
      ]
    : [];
  let partnerQuery = canSearchPartners
    ? supabase
        .from("partners")
        .select("id,name,location,campus_slugs")
        .ilike("name", pattern)
        .order("updated_at", { ascending: false })
        .limit(8)
    : null;
  let partnerIdQuery = canSearchPartners && isIdentifierQuery
    ? supabase
        .from("partners")
        .select("id,name,location,campus_slugs")
        .eq("id", normalizedQuery)
        .limit(1)
    : null;
  if (partnerQuery && managedCampusSlugs) {
    partnerQuery = partnerQuery.overlaps(
      "managed_campus_slugs",
      managedCampusSlugs,
    );
  }
  if (partnerIdQuery && managedCampusSlugs) {
    partnerIdQuery = partnerIdQuery.overlaps(
      "managed_campus_slugs",
      managedCampusSlugs,
    );
  }
  const scopedPartnerQueries = [partnerQuery, partnerIdQuery].filter(
    (query): query is NonNullable<typeof partnerQuery> => Boolean(query),
  );

  const [memberResults, partnerResults] = await Promise.all([
    Promise.all(memberQueries).catch(() => null),
    Promise.all(scopedPartnerQueries).catch(() => null),
  ]);
  const memberSearchFailed =
    memberResults === null || memberResults.some((result) => Boolean(result.error));
  const partnerSearchFailed =
    partnerResults === null || partnerResults.some((result) => Boolean(result.error));
  const members = memberResults
    ? dedupeMembers(
        memberResults.flatMap((result) =>
          result.error
            ? []
            : ((result.data ?? []) as AdminGlobalSearchMemberRow[]).map(
                (member) => ({
                  id: member.id,
                  displayName: member.display_name,
                  loginId: member.manual_login_id,
                  generation: member.generation,
                  campus: member.campus,
                }),
              ),
        ),
      )
    : [];
  const partners = partnerResults
    ? dedupePartners(
        partnerResults.flatMap((result) =>
          result.error
            ? []
            : ((result.data ?? []) as AdminGlobalSearchPartnerRow[]).map(
                (partner) => ({
                  id: partner.id,
                  name: partner.name,
                  location: partner.location,
                  campusSlugs: partner.campus_slugs,
                }),
              ),
        ),
      )
    : [];

  return { members, partners, memberSearchFailed, partnerSearchFailed };
}
