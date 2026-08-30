import { generateTempPassword, hashPassword } from "@/lib/password";
import type {
  AdminSupabaseClient,
  PartnerAccountRow,
  PartnerCompanyInput,
  PartnerCompanyProvision,
  PartnerCompanyRow,
} from "../shared-types";
import {
  normalizePartnerAccountRow,
  normalizePartnerCompanyRow,
  toPartnerAccountDisplayName,
  toPartnerAccountLoginId,
} from "./shared";
import { buildPartnerCompanySlug } from "./slug";

type CleanupQueryResult = {
  error: { code?: string; message: string } | null;
};

async function runPartnerCompanyCleanup(
  stage: string,
  operation: () => PromiseLike<CleanupQueryResult>,
) {
  const { error } = await operation();
  if (!error) {
    return true;
  }

  console.error("[partner-company-provision] cleanup failed", {
    stage,
    code: error.code ?? null,
    message: error.message,
  });
  return false;
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
    };
  }

  const cleanupTasks: Array<() => Promise<void>> = [];
  let company: PartnerCompanyRow | null = null;
  let account: PartnerAccountRow | null = null;
  let createdCompany = false;
  let createdAccount = false;
  let createdLink = false;

  try {
    if (hasCompanySelection) {
      const { data, error } = await supabase
        .from("partner_companies")
        .select("id,name,slug,description,is_active,managed_campus_slugs")
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
      };
    }

    if (!companyInput.name) {
      throw new Error("partner_company_missing_name");
    }
    if (!companyInput.contactEmail) {
      throw new Error("partner_company_missing_email");
    }

    const { data: created, error } = await supabase
      .from("partner_companies")
      .insert({
        name: companyInput.name,
        slug: buildPartnerCompanySlug(companyInput.name),
        description: companyInput.description,
        is_active: true,
        managed_campus_slugs: options.managedCampusSlugs ?? [],
      })
      .select("id,name,slug,description,is_active,managed_campus_slugs")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    company = normalizePartnerCompanyRow(created as PartnerCompanyRow);
    createdCompany = true;
    cleanupTasks.push(async () => {
      const cleaned = await runPartnerCompanyCleanup(
        "partner_company",
        () =>
          supabase
            .from("partner_companies")
            .delete()
            .eq("id", company?.id ?? ""),
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
      .select("id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at")
      .eq("login_id", loginId)
      .maybeSingle();

    if (accountLookupError) {
      throw new Error(accountLookupError.message);
    }

    if (existingAccount) {
      const { data: updatedAccount, error: updateError } = await supabase
        .from("partner_accounts")
        .update({
          display_name: displayName,
          email: loginId,
          is_active: true,
        })
        .eq("id", existingAccount.id)
        .select("id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at")
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }
      account = normalizePartnerAccountRow(updatedAccount as PartnerAccountRow);
    } else {
      const passwordRecord = hashPassword(generateTempPassword(12));
      const { data: createdAccountRow, error: createAccountError } = await supabase
        .from("partner_accounts")
        .insert({
          login_id: loginId,
          display_name: displayName,
          email: loginId,
          password_hash: passwordRecord.hash,
          password_salt: passwordRecord.salt,
          must_change_password: true,
          is_active: true,
          email_verified_at: null,
          initial_setup_completed_at: null,
        })
        .select("id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at")
        .single();

      if (createAccountError) {
        throw new Error(createAccountError.message);
      }

      account = normalizePartnerAccountRow(createdAccountRow as PartnerAccountRow);
      createdAccount = true;
      cleanupTasks.push(async () => {
        const cleaned = await runPartnerCompanyCleanup(
          "partner_account",
          () =>
            supabase
              .from("partner_accounts")
              .delete()
              .eq("id", account?.id ?? ""),
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

    const { error: createLinkError } = await supabase
      .from("partner_account_companies")
      .insert({
        account_id: accountId,
        company_id: companyId,
        is_active: true,
      });

    if (createLinkError) {
      throw new Error(createLinkError.message);
    }

    createdLink = true;
    cleanupTasks.push(async () => {
      const cleaned = await runPartnerCompanyCleanup(
        "partner_account_company",
        () =>
          supabase
            .from("partner_account_companies")
            .delete()
            .eq("account_id", accountId)
            .eq("company_id", companyId),
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
    };
  } catch (error) {
    for (const cleanup of cleanupTasks.reverse()) {
      await cleanup().catch(() => undefined);
    }
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
            .eq("company_id", provision.company!.id),
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
            .eq("id", provision.account!.id),
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
            .eq("id", provision.company!.id),
      ),
    );
  }

  if (cleanupResults.includes(false)) {
    throw new Error("partner_company_cleanup_failed");
  }
}
