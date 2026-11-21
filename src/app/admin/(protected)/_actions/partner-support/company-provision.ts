import {
  PARTNER_ACCOUNT_SELECT,
  PARTNER_COMPANY_SELECT,
  buildNewPartnerAccountInsert,
  normalizePartnerAccountRow,
  normalizePartnerCompanyRow,
  type PartnerAccountRow,
  type PartnerCompanyRow,
} from "@/lib/partner-admin/company-account-rows";
import type {
  AdminSupabaseClient,
  PartnerCompanyInput,
  PartnerCompanyProvision,
} from "../shared-types";
import {
  toPartnerAccountDisplayName,
  toPartnerAccountLoginId,
} from "./shared";
import { buildPartnerCompanySlug } from "./slug";
import { logServerError } from "@/lib/server-log";
import {
  awaitPartnerMutation,
  PartnerMutationCleanupError,
  PartnerMutationOutcomeUnknownError,
  requirePartnerMutationReceipt,
  requirePartnerMutationRow,
} from "@/lib/partner-admin/mutation-outcome";

type CleanupQueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
  status: number;
};

async function runPartnerCompanyCleanup(
  stage: string,
  operation: () => PromiseLike<CleanupQueryResult>,
  expectedRow: Readonly<Record<string, unknown>>,
) {
  const { data, error } = await awaitPartnerMutation(operation(), stage);
  if (!error) {
    requirePartnerMutationReceipt(data, [expectedRow], stage);
    return true;
  }

  logServerError("[partner-company-provision] cleanup failed", error, { stage });
  return false;
}

async function runProvisionCleanupTasks(
  cleanupTasks: Array<() => Promise<void>>,
  originalError: unknown,
) {
  const cleanupFailures: unknown[] = [];

  for (const cleanup of cleanupTasks.reverse()) {
    try {
      await cleanup();
    } catch (error) {
      if (error instanceof PartnerMutationOutcomeUnknownError) throw error;
      cleanupFailures.push(error);
    }
  }

  if (cleanupFailures.length > 0) {
    throw new PartnerMutationCleanupError("partner_company_cleanup_failed", {
      originalError,
      cleanupError: new AggregateError(cleanupFailures, "partner_company_cleanup_failed"),
    });
  }
}

export async function ensurePartnerCompanyRow(
  supabase: AdminSupabaseClient,
  companyInput: PartnerCompanyInput,
  requireCompany: boolean,
  options: { managedCampusSlugs?: string[] | null } = {},
): Promise<PartnerCompanyProvision> {
  const hasCompanySelection = Boolean(companyInput.companyId);
  const hasCompanyFields = Boolean(
    companyInput.name ||
      companyInput.description ||
      companyInput.contactName ||
      companyInput.contactEmail ||
      companyInput.contactPhone,
  );

  if (!hasCompanySelection && !hasCompanyFields) {
    if (requireCompany) {
      throw new Error("partner_company_missing_name");
    }
    return {
      company: null,
      account: null,
      createdCompany: false,
      createdAccount: false,
      createdLink: false,
      updatedAccountPreviousValues: null,
    };
  }

  const cleanupTasks: Array<() => Promise<void>> = [];
  let company: PartnerCompanyRow | null = null;
  let account: PartnerAccountRow | null = null;
  let createdCompany = false;
  let createdAccount = false;
  let createdLink = false;
  let updatedAccountPreviousValues: PartnerCompanyProvision["updatedAccountPreviousValues"] = null;

  try {
    if (hasCompanySelection) {
      const { data, error } = await supabase
        .from("partner_companies")
        .select(PARTNER_COMPANY_SELECT)
        .eq("id", companyInput.companyId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error("연결할 회사를 찾을 수 없습니다.");
      }

      company = normalizePartnerCompanyRow(data as PartnerCompanyRow);
      if (!company) {
        throw new Error("회사 정보를 처리하지 못했습니다.");
      }
      return {
        company,
        account: null,
        createdCompany: false,
        createdAccount: false,
        createdLink: false,
        updatedAccountPreviousValues: null,
      };
    }

    if (!companyInput.name) {
      throw new Error("partner_company_missing_name");
    }
    if (!companyInput.contactEmail) {
      throw new Error("partner_company_missing_email");
    }

    const companySlug = buildPartnerCompanySlug(companyInput.name);
    const { data: created, error } = await awaitPartnerMutation(supabase
      .from("partner_companies")
      .insert({
        name: companyInput.name,
        slug: companySlug,
        description: companyInput.description,
        is_active: true,
        managed_campus_slugs: options.managedCampusSlugs ?? [],
      })
      .select(PARTNER_COMPANY_SELECT)
      .single(), "company_insert");

    if (error) {
      throw new Error(error.message);
    }

    requirePartnerMutationRow(created, { name: companyInput.name, slug: companySlug }, "company_insert");

    company = normalizePartnerCompanyRow(created as PartnerCompanyRow);
    createdCompany = true;
    cleanupTasks.push(async () => {
      const cleaned = await runPartnerCompanyCleanup(
        "partner_company",
        () =>
          supabase
            .from("partner_companies")
            .delete()
            .eq("id", company?.id ?? "")
            .select("id"),
        { id: company?.id ?? "" },
      );
      if (!cleaned) {
        throw new Error("partner_company_cleanup_failed");
      }
    });

    if (!company) {
      throw new Error("회사 정보를 처리하지 못했습니다.");
    }

    const loginId = toPartnerAccountLoginId(companyInput);
    if (!loginId) {
      throw new Error("partner_company_missing_email");
    }
    const displayName = toPartnerAccountDisplayName(companyInput);

    const { data: existingAccount, error: accountLookupError } = await supabase
      .from("partner_accounts")
      .select(PARTNER_ACCOUNT_SELECT)
      .eq("login_id", loginId)
      .maybeSingle();

    if (accountLookupError) {
      throw new Error(accountLookupError.message);
    }

    if (existingAccount) {
      updatedAccountPreviousValues = {
        display_name: existingAccount.display_name,
        email: existingAccount.email ?? null,
        is_active: existingAccount.is_active ?? null,
      };
      const { data: updatedAccount, error: updateError } = await awaitPartnerMutation(supabase
        .from("partner_accounts")
        .update({
          display_name: displayName,
          email: loginId,
          is_active: true,
        })
        .eq("id", existingAccount.id)
        .select(PARTNER_ACCOUNT_SELECT)
        .single(), "company_account_update");

      if (updateError) {
        throw new Error(updateError.message);
      }
      requirePartnerMutationRow(updatedAccount, {
        id: existingAccount.id, display_name: displayName, email: loginId, is_active: true,
      }, "company_account_update");
      account = normalizePartnerAccountRow(updatedAccount as PartnerAccountRow);
      cleanupTasks.push(async () => {
        const cleaned = await runPartnerCompanyCleanup(
          "partner_account_restore",
          () =>
            supabase
              .from("partner_accounts")
              .update(updatedAccountPreviousValues!)
              .eq("id", existingAccount.id)
              .select("id,display_name,email,is_active"),
          { id: existingAccount.id, ...updatedAccountPreviousValues },
        );
        if (!cleaned) {
          throw new Error("partner_company_cleanup_failed");
        }
      });
    } else {
      const { data: createdAccountRow, error: createAccountError } = await awaitPartnerMutation(supabase
        .from("partner_accounts")
        .insert(
          buildNewPartnerAccountInsert({
            loginId,
            displayName,
            isActive: true,
            now: new Date().toISOString(),
          }),
        )
        .select(PARTNER_ACCOUNT_SELECT)
        .single(), "company_account_insert");

      if (createAccountError) {
        throw new Error(createAccountError.message);
      }

      requirePartnerMutationRow(createdAccountRow, {
        login_id: loginId, display_name: displayName, email: loginId, is_active: true,
      }, "company_account_insert");

      account = normalizePartnerAccountRow(createdAccountRow as PartnerAccountRow);
      createdAccount = true;
      cleanupTasks.push(async () => {
        const cleaned = await runPartnerCompanyCleanup(
          "partner_account",
          () =>
            supabase
              .from("partner_accounts")
              .delete()
              .eq("id", account?.id ?? "")
              .select("id"),
          { id: account?.id ?? "" },
        );
        if (!cleaned) {
          throw new Error("partner_company_cleanup_failed");
        }
      });
    }

    if (!account || !company) {
      throw new Error("회사 또는 계정 정보를 처리하지 못했습니다.");
    }
    const accountId = account.id;
    const companyId = company.id;

    const { data: createdLinkRows, error: createLinkError } = await awaitPartnerMutation(supabase
      .from("partner_account_companies")
      .insert({
        account_id: accountId,
        company_id: companyId,
        is_active: true,
      }).select("account_id,company_id,is_active"), "company_account_link_insert");

    if (createLinkError) {
      throw new Error(createLinkError.message);
    }

    requirePartnerMutationReceipt(createdLinkRows, [{
      account_id: accountId, company_id: companyId, is_active: true,
    }], "company_account_link_insert");

    createdLink = true;
    cleanupTasks.push(async () => {
      const cleaned = await runPartnerCompanyCleanup(
        "partner_account_company",
        () =>
          supabase
            .from("partner_account_companies")
            .delete()
            .eq("account_id", accountId)
            .eq("company_id", companyId)
            .select("account_id,company_id"),
        { account_id: accountId, company_id: companyId },
      );
      if (!cleaned) {
        throw new Error("partner_company_cleanup_failed");
      }
    });

    return {
      company,
      account,
      createdCompany,
      createdAccount,
      createdLink,
      updatedAccountPreviousValues,
    };
  } catch (error) {
    if (error instanceof PartnerMutationOutcomeUnknownError) throw error;
    await runProvisionCleanupTasks(cleanupTasks, error);
    throw error;
  }
}

export async function cleanupPartnerCompanyProvision(
  supabase: AdminSupabaseClient,
  provision: PartnerCompanyProvision | null,
) {
  if (!provision?.company) {
    return;
  }

  const cleanupResults: boolean[] = [];

  if (provision.createdLink && provision.account) {
    cleanupResults.push(
      await runPartnerCompanyCleanup(
        "partner_account_company",
        () =>
          supabase
            .from("partner_account_companies")
            .delete()
            .eq("account_id", provision.account!.id)
            .eq("company_id", provision.company!.id)
            .select("account_id,company_id"),
        { account_id: provision.account.id, company_id: provision.company.id },
      ),
    );
  }

  if (provision.createdAccount && provision.account) {
    cleanupResults.push(
      await runPartnerCompanyCleanup(
        "partner_account",
        () =>
          supabase
            .from("partner_accounts")
            .delete()
            .eq("id", provision.account!.id)
            .select("id"),
        { id: provision.account.id },
      ),
    );
  } else if (provision.updatedAccountPreviousValues && provision.account) {
    cleanupResults.push(
      await runPartnerCompanyCleanup(
        "partner_account_restore",
        () =>
          supabase
            .from("partner_accounts")
            .update(provision.updatedAccountPreviousValues!)
            .eq("id", provision.account!.id)
            .select("id,display_name,email,is_active"),
        { id: provision.account.id, ...provision.updatedAccountPreviousValues },
      ),
    );
  }

  if (provision.createdCompany) {
    cleanupResults.push(
      await runPartnerCompanyCleanup(
        "partner_company",
        () =>
          supabase
            .from("partner_companies")
            .delete()
            .eq("id", provision.company!.id)
            .select("id"),
        { id: provision.company.id },
      ),
    );
  }

  if (cleanupResults.includes(false)) {
    throw new PartnerMutationCleanupError("partner_company_cleanup_failed", {
      originalError: null,
      cleanupError: new Error("partner_company_cleanup_failed"),
    });
  }
}
