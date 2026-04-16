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

export async function ensurePartnerCompanyRow(
  supabase: AdminSupabaseClient,
  companyInput: PartnerCompanyInput,
  requireCompany: boolean,
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
        .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
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
        contact_name: companyInput.contactName,
        contact_email: companyInput.contactEmail.toLowerCase(),
        contact_phone: companyInput.contactPhone,
        is_active: true,
      })
      .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    company = normalizePartnerCompanyRow(created as PartnerCompanyRow);
    createdCompany = true;
    cleanupTasks.push(async () => {
      await supabase.from("partner_companies").delete().eq("id", company?.id ?? "");
    });

    if (!company) {
      throw new Error("회사 정보를 처리하지 못했습니다.");
    }

    const loginId = toPartnerAccountLoginId(companyInput, company);
    if (!loginId) {
      throw new Error("partner_company_missing_email");
    }
    const displayName = toPartnerAccountDisplayName(companyInput, company);

    const { data: existingLink, error: linkError } = await supabase
      .from("partner_account_companies")
      .select("account_id,is_active")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (linkError) {
      throw new Error(linkError.message);
    }

    if (existingLink?.account_id) {
      if (existingLink.is_active === false) {
        const { error: activateLinkError } = await supabase
          .from("partner_account_companies")
          .update({ is_active: true })
          .eq("account_id", existingLink.account_id)
          .eq("company_id", company.id);

        if (activateLinkError) {
          throw new Error(activateLinkError.message);
        }
      }

      const { data: existingAccount, error: accountError } = await supabase
        .from("partner_accounts")
        .select("id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at")
        .eq("id", existingLink.account_id)
        .maybeSingle();

      if (accountError) {
        throw new Error(accountError.message);
      }
      if (!existingAccount) {
        throw new Error("연결된 업체 계정을 찾을 수 없습니다.");
      }

      const nextAccount = {
        login_id: loginId,
        display_name: displayName,
        email: loginId,
        is_active: true,
      };

      const hasAccountChanges =
        nextAccount.login_id !== existingAccount.login_id ||
        nextAccount.display_name !== existingAccount.display_name ||
        nextAccount.email !== existingAccount.email ||
        Boolean(existingAccount.is_active) !== true;

      if (hasAccountChanges) {
        const { data: updatedAccount, error: updateError } = await supabase
          .from("partner_accounts")
          .update(nextAccount)
          .eq("id", existingAccount.id)
          .select("id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at")
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }
        account = normalizePartnerAccountRow(updatedAccount as PartnerAccountRow);
      } else {
        account = normalizePartnerAccountRow(existingAccount as PartnerAccountRow);
      }
    } else {
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
          await supabase.from("partner_accounts").delete().eq("id", account?.id ?? "");
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
        await supabase
          .from("partner_account_companies")
          .delete()
          .eq("account_id", accountId)
          .eq("company_id", companyId);
      });
    }

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

  if (provision.createdLink && provision.account) {
    await supabase
      .from("partner_account_companies")
      .delete()
      .eq("account_id", provision.account.id)
      .eq("company_id", provision.company.id);
  }

  if (provision.createdAccount && provision.account) {
    await supabase.from("partner_accounts").delete().eq("id", provision.account.id);
  }

  if (provision.createdCompany) {
    await supabase.from("partner_companies").delete().eq("id", provision.company.id);
  }
}
