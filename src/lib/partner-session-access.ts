import { isPartnerPortalMock } from "./partner-portal.ts";
import { isMissingPartnerAuthSessionVersionColumnError } from "./partner-auth/accounts.ts";
import {
  findMockPartnerPortalAccountById,
  listMockPartnerPortalCompanySetups,
} from "./mock/partner-portal/store.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";
import type { PartnerSession } from "./partner-session.ts";

export type PartnerSessionAccessSnapshot = {
  isActive: boolean;
  loginId: string;
  displayName: string;
  companyIds: string[];
  authSessionVersion: number;
  mustChangePassword: boolean;
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
    loginId: setup.account.loginId,
    displayName: setup.account.displayName,
    companyIds: linkedCompanyIds.filter((companyId) => activeCompanyIds.has(companyId)),
    authSessionVersion: setup.account.authSessionVersion,
    mustChangePassword: setup.account.mustChangePassword,
  };
}

async function loadSupabasePartnerSessionAccess(
  accountId: string,
): Promise<PartnerSessionAccessSnapshot | null> {
  const supabase = getSupabaseAdminClient();
  const accountPromise = supabase
    .from("partner_accounts")
    .select("id,login_id,display_name,is_active,must_change_password,auth_session_version")
    .eq("id", accountId)
    .eq("is_active", true)
    .maybeSingle();
  const companyLinksPromise = supabase
    .from("partner_account_companies")
    .select("company_id,company:partner_companies!inner(id,is_active)")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .eq("company.is_active", true)
    .order("created_at", { ascending: true });
  const [primaryAccountResult, companyLinksResult] = await Promise.all([
    accountPromise,
    companyLinksPromise,
  ]);
  let accountResult = primaryAccountResult;

  if (
    accountResult.error &&
    isMissingPartnerAuthSessionVersionColumnError(accountResult.error.message)
  ) {
    accountResult = await supabase
      .from("partner_accounts")
      .select("id,login_id,display_name,is_active,must_change_password")
      .eq("id", accountId)
      .eq("is_active", true)
      .maybeSingle();
  }

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
    loginId: String(accountResult.data.login_id ?? ""),
    displayName: String(accountResult.data.display_name ?? ""),
    companyIds: normalizeCompanyIds(activeCompanyIds),
    authSessionVersion: Number(accountResult.data.auth_session_version ?? 1),
    mustChangePassword: Boolean(accountResult.data.must_change_password),
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
    if (
      !access?.isActive ||
      companyIds.length === 0 ||
      !Number.isInteger(access.authSessionVersion) ||
      access.authSessionVersion < 1 ||
      access.authSessionVersion !== session.authSessionVersion
    ) {
      return null;
    }

    return {
      ...session,
      loginId: access.loginId,
      displayName: access.displayName,
      companyIds,
      authSessionVersion: access.authSessionVersion,
      mustChangePassword: access.mustChangePassword,
    };
  } catch {
    return null;
  }
}
