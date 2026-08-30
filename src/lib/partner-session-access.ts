import { isPartnerPortalMock } from "./partner-portal.ts";
import {
  findMockPartnerPortalAccountById,
  listMockPartnerPortalCompanySetups,
} from "./mock/partner-portal/store.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";
import type { PartnerSession } from "./partner-session.ts";

export type PartnerSessionAccessSnapshot = {
  isActive: boolean;
  companyIds: string[];
};

export type PartnerSessionAccessLoader = (
  accountId: string,
) => Promise<PartnerSessionAccessSnapshot | null>;

type PartnerCompanyRelation = {
  id?: string | null;
  is_active?: boolean | null;
};

type PartnerAccountCompanyAccessRow = {
  company_id?: string | null;
  company?: PartnerCompanyRelation | PartnerCompanyRelation[] | null;
};

function normalizeCompanyIds(companyIds: readonly unknown[]) {
  const normalized = companyIds
    .filter((companyId): companyId is string => typeof companyId === "string")
    .map((companyId) => companyId.trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function normalizeCompanyRelation(value: unknown): PartnerCompanyRelation | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as PartnerCompanyRelation | undefined) ?? null;
  }
  return typeof value === "object" ? (value as PartnerCompanyRelation) : null;
}

async function loadMockPartnerSessionAccess(
  accountId: string,
): Promise<PartnerSessionAccessSnapshot | null> {
  const setup = findMockPartnerPortalAccountById(accountId);
  if (!setup) {
    return null;
  }

  const linkedCompanyIds = normalizeCompanyIds(
    setup.account.linkedCompanyIds ?? [setup.company.id],
  );
  const activeCompanyIds = new Set(
    listMockPartnerPortalCompanySetups(linkedCompanyIds).map(
      (companySetup) => companySetup.company.id,
    ),
  );

  return {
    isActive: setup.account.isActive,
    companyIds: linkedCompanyIds.filter((companyId) => activeCompanyIds.has(companyId)),
  };
}

async function loadSupabasePartnerSessionAccess(
  accountId: string,
): Promise<PartnerSessionAccessSnapshot | null> {
  const supabase = getSupabaseAdminClient();
  const [accountResult, companyLinksResult] = await Promise.all([
    supabase
      .from("partner_accounts")
      .select("id,is_active")
      .eq("id", accountId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("partner_account_companies")
      .select("company_id,company:partner_companies!inner(id,is_active)")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .eq("company.is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }
  if (companyLinksResult.error) {
    throw companyLinksResult.error;
  }
  if (!accountResult.data) {
    return null;
  }

  const activeCompanyIds = (companyLinksResult.data ?? [])
    .filter((row) => {
      const company = normalizeCompanyRelation(
        (row as PartnerAccountCompanyAccessRow).company,
      );
      return company?.is_active === true;
    })
    .map((row) => (row as PartnerAccountCompanyAccessRow).company_id);

  return {
    isActive: accountResult.data.is_active === true,
    companyIds: normalizeCompanyIds(activeCompanyIds),
  };
}

export const loadCurrentPartnerSessionAccess: PartnerSessionAccessLoader =
  isPartnerPortalMock
    ? loadMockPartnerSessionAccess
    : loadSupabasePartnerSessionAccess;

export async function revalidatePartnerSessionAccess(
  session: PartnerSession,
  loadAccess: PartnerSessionAccessLoader = loadCurrentPartnerSessionAccess,
): Promise<PartnerSession | null> {
  try {
    const access = await loadAccess(session.accountId);
    const companyIds = normalizeCompanyIds(access?.companyIds ?? []);
    if (!access?.isActive || companyIds.length === 0) {
      return null;
    }

    return {
      ...session,
      companyIds,
    };
  } catch {
    return null;
  }
}
