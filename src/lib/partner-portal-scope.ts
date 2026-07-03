import { isPartnerPortalMock } from "@/lib/partner-portal";
import type { PartnerSession } from "@/lib/partner-session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { listMockPartnerPortalCompanySetups } from "@/lib/mock/partner-portal/store";
import { getPartnerChangeRequestContext } from "@/lib/partner-change-requests";

export type PartnerPortalCompanyScope = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  serviceCount: number;
};

type PartnerCompanyScopeRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

type PartnerServiceCompanyRow = {
  company_id?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

export function normalizePartnerPortalCompanyIds(companyIds: string[]) {
  return [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
}

export function isPartnerPortalCompanyAllowed(
  session: PartnerSession | null,
  companyId: string,
) {
  if (!session) {
    return false;
  }
  const normalizedCompanyId = companyId.trim();
  if (!normalizedCompanyId) {
    return false;
  }
  return normalizePartnerPortalCompanyIds(session.companyIds).includes(
    normalizedCompanyId,
  );
}

function toMockCompanyScope(
  setup: ReturnType<typeof listMockPartnerPortalCompanySetups>[number],
): PartnerPortalCompanyScope {
  return {
    id: setup.company.id,
    name: setup.company.name,
    slug: setup.company.slug,
    description: setup.company.description ?? null,
    serviceCount: setup.company.services.length,
  };
}

async function getSupabasePartnerPortalCompanySummaries(
  companyIds: string[],
): Promise<PartnerPortalCompanyScope[]> {
  const uniqueCompanyIds = normalizePartnerPortalCompanyIds(companyIds).filter(isUuid);
  if (uniqueCompanyIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const [companyResult, serviceResult] = await Promise.all([
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,created_at")
      .in("id", uniqueCompanyIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("company_id")
      .in("company_id", uniqueCompanyIds),
  ]);

  if (companyResult.error) {
    throw new Error(companyResult.error.message);
  }
  if (serviceResult.error) {
    throw new Error(serviceResult.error.message);
  }

  const serviceCountByCompanyId = new Map<string, number>();
  for (const service of (serviceResult.data ?? []) as PartnerServiceCompanyRow[]) {
    const companyId = service.company_id ?? "";
    if (!companyId) {
      continue;
    }
    serviceCountByCompanyId.set(
      companyId,
      (serviceCountByCompanyId.get(companyId) ?? 0) + 1,
    );
  }

  return ((companyResult.data ?? []) as PartnerCompanyScopeRow[]).map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description ?? null,
    serviceCount: serviceCountByCompanyId.get(company.id) ?? 0,
  }));
}

export async function getPartnerPortalCompanySummaries(companyIds: string[]) {
  const uniqueCompanyIds = normalizePartnerPortalCompanyIds(companyIds);
  if (uniqueCompanyIds.length === 0) {
    return [];
  }

  if (isPartnerPortalMock) {
    return listMockPartnerPortalCompanySetups(uniqueCompanyIds).map(toMockCompanyScope);
  }

  return getSupabasePartnerPortalCompanySummaries(uniqueCompanyIds);
}

export async function assertPartnerPortalCompanyAccess(
  session: PartnerSession | null,
  companyId: string,
) {
  if (!isPartnerPortalCompanyAllowed(session, companyId)) {
    return null;
  }
  const [scope] = await getPartnerPortalCompanySummaries([companyId]);
  return scope ?? null;
}

export async function resolvePartnerPortalCompanyIdForService(
  session: PartnerSession,
  partnerId: string,
) {
  const context = await getPartnerChangeRequestContext(
    session.companyIds,
    partnerId,
    session.accountId,
  );
  return context?.companyId ?? null;
}
