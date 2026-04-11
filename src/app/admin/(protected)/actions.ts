"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isWithinPeriod, normalizePartnerLoginId } from "@/lib/partner-utils";
import { createNewPartnerPayload, isPushConfigured, sendPushToAudience } from "@/lib/push";
import { clearAdminSession, requireAdmin } from "@/lib/auth";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { generateCode, hashCode } from "@/lib/mm-verification";
import { sendPartnerPortalInitialSetupEmail } from "@/lib/partner-email";
import type { PartnerVisibility } from "@/lib/types";
import {
  buildMemberSyncLogProperties,
  syncMembersBySelectableYears,
} from "@/lib/mm-member-sync";
import {
  parseManualMemberAddInputList,
  provisionManualMembers,
  type ManualMemberAddFormState,
  type ManualMemberAddYear,
} from "@/lib/member-manual-add";
import {
  isPartnerVisibility,
  normalizePartnerVisibility,
} from "@/lib/partner-visibility";
import { parsePartnerAudienceSelection } from "@/lib/partner-audience";
import {
  parsePartnerMediaManifest,
} from "@/lib/partner-media";
import {
  deletePartnerMediaUrls,
  uploadPartnerMediaFile,
} from "@/lib/partner-media-storage";
import {
  clearSsafyCycleOverride,
  getConfiguredCurrentSsafyYear,
  getSsafyCycleSettings,
  setSsafyCycleEarlyStart,
  upsertSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  isValidEmail,
  parseMemberYearValue,
  validateCategoryKey,
  validateMemberYear,
  validateDateRange,
} from "@/lib/validation";
import { SITE_URL } from "@/lib/site";
import { getMemberAuthCleanupKeys } from "@/lib/member-auth-security";
import {
  approvePartnerChangeRequest as approvePartnerChangeRequestRecord,
  rejectPartnerChangeRequest as rejectPartnerChangeRequestRecord,
} from "@/lib/partner-change-requests";

type PartnerCoreInput = {
  name: string;
  categoryId: string;
  location: string;
  mapUrl: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  conditions: string[];
  benefits: string[];
  appliesTo: string[];
  tags: string[];
  visibility: PartnerVisibility;
};

type PartnerMediaInput = {
  thumbnail: string | null;
  images: string[];
  uploadedUrls: string[];
};

type PartnerCompanyInput = {
  companyId: string | null;
  name: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

type PartnerCompanyCrudInput = {
  companyId: string | null;
  name: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
};

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
};

type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PartnerAccountCompanyRole = "owner" | "admin" | "manager" | "viewer";

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseOptionalUrl(value: string) {
  return sanitizeHttpUrl(value) ?? null;
}

function parsePartnerLink(value: string) {
  return sanitizePartnerLinkValue(value) ?? null;
}

function parsePartnerCompanyPayload(formData: FormData): PartnerCompanyInput {
  const companyId = String(formData.get("companyId") || "").trim();
  const name = String(formData.get("companyName") || "").trim();
  const description = String(formData.get("companyDescription") || "").trim();
  const contactName = String(formData.get("companyContactName") || "").trim();
  const contactEmail = String(formData.get("companyContactEmail") || "").trim();
  const contactPhone = String(formData.get("companyContactPhone") || "").trim();

  if (contactEmail && !isValidEmail(contactEmail)) {
    throw new Error("담당자 이메일 형식이 올바르지 않습니다.");
  }

  return {
    companyId: companyId || null,
    name,
    description: description || null,
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
  };
}

function parsePartnerCompanyCrudPayload(
  formData: FormData,
): PartnerCompanyCrudInput {
  const companyId = String(formData.get("companyId") || "").trim();
  const name = String(formData.get("companyName") || "").trim();
  const description = String(formData.get("companyDescription") || "").trim();
  const contactName = String(formData.get("companyContactName") || "").trim();
  const contactEmail = String(formData.get("companyContactEmail") || "").trim();
  const contactPhone = String(formData.get("companyContactPhone") || "").trim();
  const isActive = formData.getAll("companyIsActive").includes("true");

  if (!name) {
    throw new Error("협력사명을 입력해 주세요.");
  }
  if (contactEmail && !isValidEmail(contactEmail)) {
    throw new Error("담당자 이메일 형식이 올바르지 않습니다.");
  }

  return {
    companyId: companyId || null,
    name,
    description: description || null,
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
    isActive,
  };
}

function parsePartnerAccountPayload(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const loginId = normalizePartnerLoginId(String(formData.get("loginId") || "").trim());
  const displayName = String(formData.get("displayName") || "").trim();
  const isActive = formData.getAll("isActive").includes("true");
  const mustChangePassword = formData.getAll("mustChangePassword").includes("true");

  if (!id) {
    throw new Error("수정할 업체 계정을 찾을 수 없습니다.");
  }
  if (!loginId) {
    throw new Error("로그인 아이디를 입력해 주세요.");
  }
  if (!isValidEmail(loginId)) {
    throw new Error("로그인 아이디는 올바른 이메일이어야 합니다.");
  }
  if (!displayName) {
    throw new Error("표시명을 입력해 주세요.");
  }

  return {
    id,
    loginId,
    displayName,
    isActive,
    mustChangePassword,
  };
}

function parsePartnerAccountCompanyPayload(formData: FormData) {
  const accountId = String(formData.get("accountId") || "").trim();
  const companyId = String(formData.get("companyId") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const isActive = formData.getAll("isActive").includes("true");

  if (!accountId || !companyId) {
    throw new Error("권한을 변경할 계정과 회사를 찾을 수 없습니다.");
  }
  if (!["owner", "admin", "manager", "viewer"].includes(role)) {
    throw new Error("권한은 owner, admin, manager, viewer 중 하나여야 합니다.");
  }

  return {
    accountId,
    companyId,
    role: role as PartnerAccountCompanyRole,
    isActive,
  };
}

function buildPartnerCompanySlug(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);

  const base = normalized || "partner-company";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function toPartnerAccountDisplayName(company: PartnerCompanyInput, companyRow?: PartnerCompanyRow | null) {
  return (
    company.contactName ||
    companyRow?.contact_name ||
    company.name ||
    companyRow?.name ||
    "제휴 담당자"
  );
}

function toPartnerAccountLoginId(company: PartnerCompanyInput, companyRow?: PartnerCompanyRow | null) {
  const email = company.contactEmail || companyRow?.contact_email || "";
  return email.trim().toLowerCase();
}

function normalizePartnerCompanyRow(row: PartnerCompanyRow | null | undefined) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    contact_name: row.contact_name ?? null,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    is_active: row.is_active ?? true,
  } satisfies PartnerCompanyRow;
}

function normalizePartnerAccountRow(
  row: PartnerAccountRow | null | undefined,
) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    login_id: row.login_id,
    display_name: row.display_name,
    email: row.email ?? null,
    password_hash: row.password_hash ?? null,
    password_salt: row.password_salt ?? null,
    must_change_password: row.must_change_password ?? true,
    is_active: row.is_active ?? true,
    email_verified_at: row.email_verified_at ?? null,
    initial_setup_completed_at: row.initial_setup_completed_at ?? null,
    initial_setup_link_sent_at: row.initial_setup_link_sent_at ?? null,
    last_login_at: row.last_login_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  } satisfies PartnerAccountRow;
}

async function issuePartnerAccountInitialSetupLink(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  accountId: string,
) {
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }
  if (!account) {
    throw new Error("초기설정 URL을 전송할 계정을 찾을 수 없습니다.");
  }
  if (!account.is_active) {
    throw new Error("비활성화된 계정입니다. 먼저 활성화해 주세요.");
  }
  if (account.initial_setup_completed_at) {
    throw new Error("이미 초기 설정이 완료된 계정입니다.");
  }

  const emailSentTo = normalizePartnerLoginId(account.email ?? account.login_id);
  if (!isValidEmail(emailSentTo)) {
    throw new Error("담당자 이메일 형식이 올바르지 않습니다.");
  }

  const setupToken = randomUUID();
  const verificationCode = generateCode();
  const verificationCodeHash = hashCode(verificationCode);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("partner_accounts")
    .update({
      initial_setup_token: setupToken,
      initial_setup_verification_code_hash: verificationCodeHash,
      initial_setup_link_sent_at: null,
      must_change_password: true,
      email_verified_at: null,
      updated_at: now,
    })
    .eq("id", account.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    account,
    emailSentTo,
    setupToken,
    setupUrl: new URL(`/partner/setup/${setupToken}`, SITE_URL).toString(),
    verificationCode,
    now,
  };
}

async function ensurePartnerCompanyRow(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  companyInput: PartnerCompanyInput,
  requireCompany: boolean,
) {
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
      throw new Error("회사명과 담당자 이메일을 입력해 주세요.");
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
      const currentCompany = company;

      const nextCompany = {
        name: companyInput.name || currentCompany.name,
        slug: currentCompany.slug,
        description:
          companyInput.description !== null && companyInput.description !== undefined
            ? companyInput.description
            : currentCompany.description ?? null,
        contact_name:
          companyInput.contactName !== null && companyInput.contactName !== undefined
            ? companyInput.contactName
            : currentCompany.contact_name ?? null,
        contact_email:
          companyInput.contactEmail !== null && companyInput.contactEmail !== undefined
            ? companyInput.contactEmail.toLowerCase()
            : currentCompany.contact_email ?? null,
        contact_phone:
          companyInput.contactPhone !== null && companyInput.contactPhone !== undefined
            ? companyInput.contactPhone
            : currentCompany.contact_phone ?? null,
        is_active: currentCompany.is_active ?? true,
      };

      const hasChanges =
        nextCompany.name !== currentCompany.name ||
        nextCompany.description !== currentCompany.description ||
        nextCompany.contact_name !== currentCompany.contact_name ||
        nextCompany.contact_email !== currentCompany.contact_email ||
        nextCompany.contact_phone !== currentCompany.contact_phone;

      if (hasChanges) {
        const { data: updatedCompany, error: updateError } = await supabase
          .from("partner_companies")
          .update(nextCompany)
          .eq("id", currentCompany.id)
          .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        company = normalizePartnerCompanyRow(updatedCompany as PartnerCompanyRow);
      }
    } else {
      if (!companyInput.name) {
        throw new Error("회사명을 입력해 주세요.");
      }
      if (!companyInput.contactEmail) {
        throw new Error("담당자 이메일을 입력해 주세요.");
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
    }

    if (!company) {
      throw new Error("회사 정보를 처리하지 못했습니다.");
    }

    const resolvedCompany = company;
    const loginId = toPartnerAccountLoginId(companyInput, resolvedCompany);
    if (!loginId) {
      throw new Error("담당자 이메일을 입력해 주세요.");
    }
    const displayName = toPartnerAccountDisplayName(companyInput, resolvedCompany);

    const { data: existingLink, error: linkError } = await supabase
      .from("partner_account_companies")
      .select("account_id,is_active")
      .eq("company_id", resolvedCompany.id)
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
        .eq("company_id", resolvedCompany.id);

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
        account = updatedAccount as PartnerAccountRow;
      } else {
        account = existingAccount as PartnerAccountRow;
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
        account = updatedAccount as PartnerAccountRow;
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

        account = createdAccountRow as PartnerAccountRow;
        createdAccount = true;
        cleanupTasks.push(async () => {
          await supabase.from("partner_accounts").delete().eq("id", account?.id ?? "");
        });
      }

      const { error: createLinkError } = await supabase
        .from("partner_account_companies")
        .insert({
          account_id: account.id,
          company_id: resolvedCompany.id,
          role: "owner",
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
          .eq("account_id", account?.id ?? "")
          .eq("company_id", resolvedCompany.id);
      });
    }

    return {
      company: resolvedCompany,
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

async function cleanupPartnerCompanyProvision(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  provision: Awaited<ReturnType<typeof ensurePartnerCompanyRow>> | null,
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
    await supabase
      .from("partner_accounts")
      .delete()
      .eq("id", provision.account.id);
  }

  if (provision.createdCompany) {
    await supabase
      .from("partner_companies")
      .delete()
      .eq("id", provision.company.id);
  }
}

async function logAdminAction(
  action: Parameters<typeof logAdminAudit>[0]["action"],
  input?: {
    targetType?: string | null;
    targetId?: string | null;
    properties?: Record<string, unknown> | null;
  },
) {
  const context = await getServerActionLogContext("/admin");
  await logAdminAudit({
    ...context,
    action,
    targetType: input?.targetType ?? null,
    targetId: input?.targetId ?? null,
    properties: input?.properties ?? {},
  });
}

function revalidateAdminAndPublicPaths(partnerId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/partners/[id]", "page");
  if (partnerId) {
    revalidatePath(`/partners/${partnerId}`);
  }
}

function revalidatePartnerPortalPaths(partnerId?: string) {
  revalidatePath("/partner");
  revalidatePath("/admin/partners");
  if (partnerId) {
    revalidatePath(`/partner/services/${partnerId}`);
    revalidatePath(`/partner/services/${partnerId}/request`);
  }
}

function revalidateCategoryData() {
  revalidateTag("categories", "max");
}

function revalidatePartnerData() {
  revalidateTag("partners", "max");
}

function revalidatePartnerAccountData() {
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/partners");
}

function revalidatePartnerCompanyData() {
  revalidateTag("partners", "max");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/partners");
  revalidatePath("/partner");
  revalidatePath("/partners/[id]", "page");
  revalidatePath("/partner/services/[partnerId]", "page");
  revalidatePath("/partner/services/[partnerId]/request", "page");
}

function revalidateMemberPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/partners");
  revalidatePath("/admin/cycle");
  revalidatePath("/certification");
  revalidatePath("/auth/change-password");
}

function revalidateCyclePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/cycle");
  revalidatePath("/admin/members");
  revalidatePath("/admin/push");
  revalidatePath("/auth/signup");
  revalidatePath("/certification");
}

export async function updatePartnerAccount(formData: FormData) {
  await requireAdmin();
  const payload = parsePartnerAccountPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data: existingAccount, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,last_login_at,created_at,updated_at",
    )
    .eq("id", payload.id)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }
  if (!existingAccount) {
    throw new Error("수정할 업체 계정을 찾을 수 없습니다.");
  }

  const currentAccount = normalizePartnerAccountRow(existingAccount as PartnerAccountRow);
  if (!currentAccount) {
    throw new Error("업체 계정 정보를 처리하지 못했습니다.");
  }

  const nextAccount = {
    login_id: payload.loginId,
    display_name: payload.displayName,
    email: payload.loginId,
    is_active: payload.isActive,
    must_change_password: payload.mustChangePassword,
    updated_at: new Date().toISOString(),
  };

  const hasChanges =
    currentAccount.login_id !== nextAccount.login_id ||
    currentAccount.display_name !== nextAccount.display_name ||
    (currentAccount.email ?? currentAccount.login_id) !== nextAccount.email ||
    Boolean(currentAccount.is_active) !== nextAccount.is_active ||
    Boolean(currentAccount.must_change_password) !== nextAccount.must_change_password;

  if (hasChanges) {
    const { error } = await supabase
      .from("partner_accounts")
      .update(nextAccount)
      .eq("id", payload.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  const linkedCompanyCount = await supabase
    .from("partner_account_companies")
    .select("id", { count: "exact", head: true })
    .eq("account_id", payload.id)
    .eq("is_active", true);

  await logAdminAction("partner_account_update", {
    targetType: "partner_account",
    targetId: payload.id,
    properties: {
      loginId: payload.loginId,
      displayName: payload.displayName,
      isActive: payload.isActive,
      mustChangePassword: payload.mustChangePassword,
      companyCount: linkedCompanyCount.count ?? 0,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies");
}

export async function createPartnerAccountInitialSetupUrl(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("id") || "").trim();
  if (!accountId) {
    throw new Error("초기설정 URL을 생성할 계정을 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const issued = await issuePartnerAccountInitialSetupLink(supabase, accountId);

  await logAdminAction("partner_account_initial_setup_link_generate", {
    targetType: "partner_account",
    targetId: issued.account.id,
    properties: {
      loginId: issued.account.login_id,
      displayName: issued.account.display_name,
      emailSentTo: issued.emailSentTo,
      setupLinkGeneratedAt: issued.now,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies");
}

export async function sendPartnerAccountInitialSetupUrl(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("id") || "").trim();
  if (!accountId) {
    throw new Error("초기설정 URL을 전송할 계정을 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const issued = await issuePartnerAccountInitialSetupLink(supabase, accountId);

  try {
    await sendPartnerPortalInitialSetupEmail({
      to: issued.emailSentTo,
      displayName: issued.account.display_name,
      loginId: issued.account.login_id,
      setupUrl: issued.setupUrl,
      verificationCode: issued.verificationCode,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "초기설정 URL 전송에 실패했습니다.",
    );
  }

  const { error: sentAtError } = await supabase
    .from("partner_accounts")
    .update({
      initial_setup_link_sent_at: issued.now,
      updated_at: issued.now,
    })
    .eq("id", issued.account.id);

  if (sentAtError) {
    throw new Error(sentAtError.message);
  }

  await logAdminAction("partner_account_initial_setup_link_send", {
    targetType: "partner_account",
    targetId: issued.account.id,
    properties: {
      loginId: issued.account.login_id,
      displayName: issued.account.display_name,
      emailSentTo: issued.emailSentTo,
      setupLinkSentAt: issued.now,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies");
}

export async function updatePartnerAccountCompanyPermission(formData: FormData) {
  await requireAdmin();
  const payload = parsePartnerAccountCompanyPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data: existingLink, error: linkError } = await supabase
    .from("partner_account_companies")
    .select("id,account_id,company_id,role,is_active,created_at")
    .eq("account_id", payload.accountId)
    .eq("company_id", payload.companyId)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }
  if (!existingLink) {
    throw new Error("수정할 권한 연결을 찾을 수 없습니다.");
  }

  const nextLink = {
    role: payload.role,
    is_active: payload.isActive,
  };

  const hasChanges =
    existingLink.role !== nextLink.role ||
    Boolean(existingLink.is_active) !== nextLink.is_active;

  if (hasChanges) {
    const { error } = await supabase
      .from("partner_account_companies")
      .update(nextLink)
      .eq("id", existingLink.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  await logAdminAction("partner_account_company_update", {
    targetType: "partner_account_company",
    targetId: existingLink.id,
    properties: {
      accountId: payload.accountId,
      companyId: payload.companyId,
      role: payload.role,
      isActive: payload.isActive,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies");
}

function parseCategoryPayload(formData: FormData) {
  const key = String(formData.get("key") || "")
    .trim()
    .toLowerCase();
  const label = String(formData.get("label") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const rawColor = String(formData.get("color") || "").trim();

  if (!key || !label) {
    throw new Error("카테고리 키와 라벨을 입력해 주세요.");
  }

  const keyError = validateCategoryKey(key);
  if (keyError) {
    throw new Error(keyError);
  }

  const color = rawColor ? sanitizeHexColor(rawColor) : null;
  if (rawColor && !color) {
    throw new Error("카테고리 색상은 #RRGGBB 형식이어야 합니다.");
  }

  return {
    key,
    label,
    description,
    color,
  };
}

function parseSsafyCycleNumber(value: string, label: string, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label}는 ${min}~${max} 사이의 숫자로 입력해 주세요.`);
  }
  return parsed;
}

function parseSsafyCycleSettingsPayload(formData: FormData) {
  const anchorYearRaw = String(formData.get("anchorYear") || "").trim();
  const anchorCalendarYearRaw = String(formData.get("anchorCalendarYear") || "").trim();
  const anchorMonthRaw = String(formData.get("anchorMonth") || "").trim();

  if (!anchorYearRaw || !anchorCalendarYearRaw || !anchorMonthRaw) {
    throw new Error("기준 기수, 기준 연도, 기준 월을 모두 입력해 주세요.");
  }

  return {
    anchorYear: parseSsafyCycleNumber(anchorYearRaw, "기준 기수", 1, 99),
    anchorCalendarYear: parseSsafyCycleNumber(
      anchorCalendarYearRaw,
      "기준 연도",
      2000,
      3000,
    ),
    anchorMonth: parseSsafyCycleNumber(anchorMonthRaw, "기준 월", 1, 12),
  };
}

function parsePartnerPayload(formData: FormData): PartnerCoreInput {
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const rawMapUrl = String(formData.get("mapUrl") || "").trim();
  const rawReservationLink = String(formData.get("reservationLink") || "").trim();
  const rawInquiryLink = String(formData.get("inquiryLink") || "").trim();
  const rawVisibility = String(formData.get("visibility") || "").trim();
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();
  const conditions = String(formData.get("conditions") || "").trim();
  const benefits = String(formData.get("benefits") || "").trim();
  const tags = String(formData.get("tags") || "").trim();
  const appliesTo = formData.getAll("appliesTo").map((item) => String(item).trim());

  if (!name || !categoryId || !location) {
    throw new Error("업체명, 카테고리, 위치를 입력해 주세요.");
  }

  const dateRangeError = validateDateRange(periodStart, periodEnd);
  if (dateRangeError) {
    throw new Error(dateRangeError);
  }

  const mapUrl = parseOptionalUrl(rawMapUrl);
  if (rawMapUrl && !mapUrl) {
    throw new Error("지도 링크는 올바른 http(s) 주소여야 합니다.");
  }

  const reservationLink = parsePartnerLink(rawReservationLink);
  if (rawReservationLink && !reservationLink) {
    throw new Error("예약 링크 형식을 확인해 주세요.");
  }

  const inquiryLink = parsePartnerLink(rawInquiryLink);
  if (rawInquiryLink && !inquiryLink) {
    throw new Error("문의 링크 형식을 확인해 주세요.");
  }

  if (rawVisibility && !isPartnerVisibility(rawVisibility)) {
    throw new Error("노출 상태는 공개, 대외비, 비공개 중 하나여야 합니다.");
  }
  const visibility = normalizePartnerVisibility(rawVisibility || "public");

  const parsedAppliesTo = parsePartnerAudienceSelection(appliesTo);
  if (!parsedAppliesTo) {
    throw new Error("적용 대상을 하나 이상 선택해 주세요.");
  }

  return {
    name,
    categoryId,
    location,
    mapUrl,
    reservationLink,
    inquiryLink,
    periodStart: periodStart || null,
    periodEnd: periodEnd || null,
    conditions: parseList(conditions),
    benefits: parseList(benefits),
    appliesTo: parsedAppliesTo,
    tags: parseList(tags),
    visibility,
  };
}

function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function resolvePartnerMediaPayload(
  formData: FormData,
  partnerId: string,
): Promise<PartnerMediaInput> {
  const thumbnailManifestRaw = String(formData.get("thumbnailManifest") || "");
  const galleryManifestRaw = String(formData.get("galleryManifest") || "");
  const thumbnailManifest = parsePartnerMediaManifest(thumbnailManifestRaw);
  const galleryManifest = parsePartnerMediaManifest(galleryManifestRaw);

  if (thumbnailManifestRaw.trim() && !thumbnailManifest) {
    throw new Error("썸네일 이미지 형식을 확인해 주세요.");
  }
  if (galleryManifestRaw.trim() && !galleryManifest) {
    throw new Error("이미지 목록 형식을 확인해 주세요.");
  }

  const thumbnailFile = getFormDataFile(formData, "thumbnailFile");
  const galleryFiles = formData
    .getAll("galleryFiles")
    .filter((item): item is File => item instanceof File && item.size > 0);

  let thumbnail: string | null = null;
  const uploadedUrls: string[] = [];
  if (thumbnailManifest?.thumbnail) {
    if (thumbnailManifest.thumbnail.kind === "existing") {
      thumbnail = thumbnailManifest.thumbnail.url;
    } else {
      if (!thumbnailFile) {
        throw new Error("썸네일 이미지를 찾을 수 없습니다.");
      }
      thumbnail = await uploadPartnerMediaFile(
        partnerId,
        "thumbnail",
        thumbnailFile,
        0,
      );
      uploadedUrls.push(thumbnail);
    }
  }

  const images: string[] = [];
  let galleryFileIndex = 0;
  const galleryEntries = galleryManifest?.gallery ?? [];
  for (const [index, entry] of galleryEntries.entries()) {
    if (entry.kind === "existing") {
      images.push(entry.url);
      continue;
    }

    const nextFile = galleryFiles[galleryFileIndex++];
    if (!nextFile) {
      throw new Error("추가 이미지 파일을 찾을 수 없습니다.");
    }
    if (!nextFile.type.startsWith("image/")) {
      throw new Error("이미지 파일만 저장할 수 있습니다.");
    }

    const uploadedUrl = await uploadPartnerMediaFile(
      partnerId,
      "gallery",
      nextFile,
      index,
    );
    images.push(uploadedUrl);
    uploadedUrls.push(uploadedUrl);
  }

  return {
    thumbnail,
    images,
    uploadedUrls,
  };
}

function collectPartnerMediaUrls(row?: {
  thumbnail?: string | null;
  images?: string[] | null;
} | null) {
  if (!row) {
    return [];
  }

  const urls = [
    row.thumbnail ?? null,
    ...(row.images ?? []),
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(urls));
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const { key, label, description, color } = parseCategoryPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ key, label, description, color })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("category_create", {
    targetType: "category",
    targetId: data?.id ?? null,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
}

export async function updateCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const { key, label, description, color } = parseCategoryPayload(formData);

  if (!id) {
    throw new Error("수정할 카테고리를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ key, label, description, color })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("category_update", {
    targetType: "category",
    targetId: id,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
  redirect("/admin/companies");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("삭제할 카테고리를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("category_delete", {
    targetType: "category",
    targetId: id,
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
}

export async function createPartnerCompany(formData: FormData) {
  await requireAdmin();
  const payload = parsePartnerCompanyCrudPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_companies")
    .insert({
      name: payload.name,
      slug: buildPartnerCompanySlug(payload.name),
      description: payload.description,
      contact_name: payload.contactName,
      contact_email: payload.contactEmail?.toLowerCase() ?? null,
      contact_phone: payload.contactPhone,
      is_active: payload.isActive,
    })
    .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const company = normalizePartnerCompanyRow(data as PartnerCompanyRow);
  if (!company) {
    throw new Error("협력사 정보를 처리하지 못했습니다.");
  }

  await logAdminAction("partner_company_create", {
    targetType: "partner_company",
    targetId: company.id,
    properties: {
      name: company.name,
      slug: company.slug,
      description: company.description ?? null,
      contactName: company.contact_name ?? null,
      contactEmail: company.contact_email ?? null,
      contactPhone: company.contact_phone ?? null,
      isActive: company.is_active ?? true,
    },
  });

  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}

export async function updatePartnerCompany(formData: FormData) {
  await requireAdmin();
  const payload = parsePartnerCompanyCrudPayload(formData);
  const companyId = payload.companyId;

  if (!companyId) {
    throw new Error("수정할 협력사를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingCompany, error: companyError } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    throw new Error(companyError.message);
  }
  if (!existingCompany) {
    throw new Error("수정할 협력사를 찾을 수 없습니다.");
  }

  const nextCompany = {
    name: payload.name,
    slug: existingCompany.slug,
    description: payload.description,
    contact_name: payload.contactName,
    contact_email: payload.contactEmail?.toLowerCase() ?? null,
    contact_phone: payload.contactPhone,
    is_active: payload.isActive,
    updated_at: new Date().toISOString(),
  };

  const hasChanges =
    nextCompany.name !== existingCompany.name ||
    nextCompany.slug !== existingCompany.slug ||
    nextCompany.description !== existingCompany.description ||
    nextCompany.contact_name !== existingCompany.contact_name ||
    nextCompany.contact_email !== existingCompany.contact_email ||
    nextCompany.contact_phone !== existingCompany.contact_phone ||
    Boolean(existingCompany.is_active) !== nextCompany.is_active;

  if (hasChanges) {
    const { error: updateError } = await supabase
      .from("partner_companies")
      .update(nextCompany)
      .eq("id", companyId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  await logAdminAction("partner_company_update", {
    targetType: "partner_company",
    targetId: companyId,
    properties: {
      name: nextCompany.name,
      slug: nextCompany.slug,
      description: nextCompany.description,
      contactName: nextCompany.contact_name,
      contactEmail: nextCompany.contact_email,
      contactPhone: nextCompany.contact_phone,
      isActive: nextCompany.is_active,
    },
  });

  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}

export async function deletePartnerCompany(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("companyId") || "").trim();
  if (!companyId) {
    throw new Error("삭제할 협력사를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingCompany, error: companyError } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    throw new Error(companyError.message);
  }
  if (!existingCompany) {
    throw new Error("삭제할 협력사를 찾을 수 없습니다.");
  }

  const [brandCountResult, accountLinkCountResult] = await Promise.all([
    supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("partner_account_companies")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
  ]);

  const brandCount = brandCountResult.error ? 0 : brandCountResult.count ?? 0;
  const accountLinkCount = accountLinkCountResult.error
    ? 0
    : accountLinkCountResult.count ?? 0;

  const { error: deleteError } = await supabase
    .from("partner_companies")
    .delete()
    .eq("id", companyId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await logAdminAction("partner_company_delete", {
    targetType: "partner_company",
    targetId: companyId,
    properties: {
      name: existingCompany.name,
      slug: existingCompany.slug,
      brandCount,
      accountLinkCount,
    },
  });

  revalidatePartnerCompanyData();
  redirect("/admin/partners");
}

export async function createPartner(formData: FormData) {
  await requireAdmin();
  const payload = parsePartnerPayload(formData);
  const partnerId = randomUUID();
  const companyPayload = parsePartnerCompanyPayload(formData);
  const media = await resolvePartnerMediaPayload(formData, partnerId);

  const supabase = getSupabaseAdminClient();
  let companyProvision: Awaited<ReturnType<typeof ensurePartnerCompanyRow>> | null = null;

  try {
    companyProvision = await ensurePartnerCompanyRow(supabase, companyPayload, true);

    const { error } = await supabase.from("partners").insert({
      id: partnerId,
      company_id: companyProvision.company?.id ?? null,
      name: payload.name,
      category_id: payload.categoryId,
      location: payload.location,
      map_url: payload.mapUrl,
      reservation_link: payload.reservationLink,
      inquiry_link: payload.inquiryLink,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      conditions: payload.conditions,
      benefits: payload.benefits,
      applies_to: payload.appliesTo,
      thumbnail: media.thumbnail,
      images: media.images,
      tags: payload.tags,
      visibility: payload.visibility,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await cleanupPartnerCompanyProvision(supabase, companyProvision);
    throw error;
  }

  await logAdminAction("partner_create", {
    targetType: "partner",
    targetId: partnerId,
    properties: {
      name: payload.name,
      companyId: companyProvision?.company?.id ?? null,
      companyName: companyProvision?.company?.name ?? null,
      companyContactEmail: companyProvision?.company?.contact_email ?? null,
      categoryId: payload.categoryId,
      location: payload.location,
      hasMapUrl: Boolean(payload.mapUrl),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      conditionCount: payload.conditions.length,
      visibility: payload.visibility,
      benefitCount: payload.benefits.length,
      appliesTo: payload.appliesTo,
      hasThumbnail: Boolean(media.thumbnail),
      imageCount: media.images.length,
      tagCount: payload.tags.length,
    },
  });

  if (
    payload.visibility !== "private" &&
    isPushConfigured() &&
    isWithinPeriod(payload.periodStart, payload.periodEnd)
  ) {
    const { data: category } = await supabase
      .from("categories")
      .select("label")
      .eq("id", payload.categoryId)
      .maybeSingle();

    try {
      await sendPushToAudience(
        createNewPartnerPayload({
          partnerId,
          name: payload.name,
          location: payload.location,
          categoryLabel: category?.label ?? null,
        }),
      );
    } catch (pushError) {
      console.error("new partner push failed", pushError);
    }
  }

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(partnerId);
}

export async function updatePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
  }
  const payload = parsePartnerPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("company_id,thumbnail,images")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    throw new Error(previousPartnerError.message);
  }
  if (!previousPartner) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
  }

  const companyPayload = parsePartnerCompanyPayload(formData);
  const media = await resolvePartnerMediaPayload(formData, id);
  const hasCompanyPayload = Boolean(
    companyPayload.companyId ||
      companyPayload.name ||
      companyPayload.description ||
      companyPayload.contactName ||
      companyPayload.contactEmail ||
      companyPayload.contactPhone,
  );
  let companyProvision: Awaited<ReturnType<typeof ensurePartnerCompanyRow>> | null = null;
  let nextCompanyId = previousPartner.company_id ?? null;

  if (hasCompanyPayload) {
    companyProvision = await ensurePartnerCompanyRow(
      supabase,
      companyPayload,
      Boolean(previousPartner.company_id || hasCompanyPayload),
    );
    if (companyProvision.company) {
      nextCompanyId = companyProvision.company.id;
    }
  }

  try {
    const { error } = await supabase
      .from("partners")
      .update({
        company_id: nextCompanyId,
        name: payload.name,
        category_id: payload.categoryId,
        location: payload.location,
        map_url: payload.mapUrl,
        reservation_link: payload.reservationLink,
        inquiry_link: payload.inquiryLink,
        period_start: payload.periodStart,
        period_end: payload.periodEnd,
        conditions: payload.conditions,
        benefits: payload.benefits,
        applies_to: payload.appliesTo,
        thumbnail: media.thumbnail,
        images: media.images,
        tags: payload.tags,
        visibility: payload.visibility,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await cleanupPartnerCompanyProvision(supabase, companyProvision);
    throw error;
  }

  const previousUrls = collectPartnerMediaUrls(previousPartner);
  const nextUrls = collectPartnerMediaUrls({
    thumbnail: media.thumbnail,
    images: media.images,
  });
  const removedUrls = previousUrls.filter((url) => !nextUrls.includes(url));
  await deletePartnerMediaUrls(removedUrls).catch(() => undefined);

  await logAdminAction("partner_update", {
    targetType: "partner",
    targetId: id,
    properties: {
      name: payload.name,
      companyId: nextCompanyId,
      companyName: companyProvision?.company?.name ?? null,
      companyContactEmail: companyProvision?.company?.contact_email ?? null,
      categoryId: payload.categoryId,
      location: payload.location,
      hasMapUrl: Boolean(payload.mapUrl),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      conditionCount: payload.conditions.length,
      visibility: payload.visibility,
      benefitCount: payload.benefits.length,
      appliesTo: payload.appliesTo,
      hasThumbnail: Boolean(media.thumbnail),
      imageCount: media.images.length,
      tagCount: payload.tags.length,
    },
  });
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
  redirect("/admin/partners");
}

export async function approvePartnerChangeRequest(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    throw new Error("승인할 요청을 찾을 수 없습니다.");
  }

  const request = await approvePartnerChangeRequestRecord({
    requestId,
    adminId: process.env.ADMIN_ID ?? "admin",
  });

  await logAdminAction("partner_change_request_approve", {
    targetType: "partner_change_request",
    targetId: request.id,
      properties: {
        partnerId: request.partnerId,
        partnerName: request.partnerName,
        companyId: request.companyId,
        companyName: request.companyName,
        requestedConditionsCount: request.requestedConditions.length,
        requestedBenefitsCount: request.requestedBenefits.length,
        requestedTagsCount: request.requestedTags.length,
        requestedAppliesTo: request.requestedAppliesTo,
        requestedThumbnail: Boolean(request.requestedThumbnail),
        requestedImagesCount: request.requestedImages.length,
        requestedReservationLink: Boolean(request.requestedReservationLink),
        requestedInquiryLink: Boolean(request.requestedInquiryLink),
      requestedPeriodStart: request.requestedPeriodStart,
      requestedPeriodEnd: request.requestedPeriodEnd,
    },
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect("/admin/partners");
}

export async function rejectPartnerChangeRequest(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    throw new Error("거절할 요청을 찾을 수 없습니다.");
  }

  const request = await rejectPartnerChangeRequestRecord({
    requestId,
    adminId: process.env.ADMIN_ID ?? "admin",
  });

  await logAdminAction("partner_change_request_reject", {
    targetType: "partner_change_request",
    targetId: request.id,
      properties: {
        partnerId: request.partnerId,
        partnerName: request.partnerName,
        companyId: request.companyId,
        companyName: request.companyName,
        requestedTagsCount: request.requestedTags.length,
        requestedThumbnail: Boolean(request.requestedThumbnail),
        requestedImagesCount: request.requestedImages.length,
        requestedReservationLink: Boolean(request.requestedReservationLink),
        requestedInquiryLink: Boolean(request.requestedInquiryLink),
        requestedPeriodStart: request.requestedPeriodStart,
      requestedPeriodEnd: request.requestedPeriodEnd,
    },
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect("/admin/partners");
}

export async function deletePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("삭제할 업체를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    throw new Error(previousPartnerError.message);
  }

  const { error } = await supabase.from("partners").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await deletePartnerMediaUrls(collectPartnerMediaUrls(previousPartner)).catch(
    () => undefined,
  );

  await logAdminAction("partner_delete", {
    targetType: "partner",
    targetId: id,
  });
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
}

export async function backfillMemberProfiles() {
  await requireAdmin();

  const context = await getServerActionLogContext("/admin/members");
  let status = "success";
  let summary = {
    checked: 0,
    updated: 0,
    skipped: 0,
    failures: 0,
  };

  try {
    const result = await syncMembersBySelectableYears();
    const actorId = process.env.ADMIN_ID ?? "admin";
    summary = {
      checked: result.checked,
      updated: result.updated,
      skipped: result.skipped,
      failures: result.failures.length,
    };

    for (const syncResult of result.results) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId,
        targetType: "member",
        targetId: syncResult.member.id,
        properties: buildMemberSyncLogProperties(syncResult, {
          source: "manual_backfill",
        }),
      });
    }
    status = result.failures.length > 0 ? "partial" : "success";
  } catch (error) {
    console.error("member backfill failed", error);
    status = "error";
  }

  revalidateMemberPaths();
  if (status === "error") {
    redirect("/admin/members?backfill=error");
  }

  redirect(
    `/admin/members?backfill=${status}&checked=${summary.checked}&updated=${summary.updated}&skipped=${summary.skipped}&failures=${summary.failures}`,
  );
}

export async function updateMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const campus = String(formData.get("campus") || "").trim();
  const mustChangePassword =
    String(formData.get("mustChangePassword") || "false").trim() === "true";

  if (!id) {
    throw new Error("수정할 회원을 찾을 수 없습니다.");
  }

  const yearError = validateMemberYear(yearRaw);
  const year = parseMemberYearValue(yearRaw);
  if (yearError || year === null) {
    throw new Error("기수는 0~99 사이의 숫자로 입력해 주세요.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({
      display_name: displayName || null,
      year,
      campus: campus || null,
      must_change_password: mustChangePassword,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("member_update", {
    targetType: "member",
    targetId: id,
    properties: {
      displayName,
      year,
      campus,
      mustChangePassword,
    },
  });
  revalidateMemberPaths();
  redirect("/admin/members");
}

export async function manualAddMembers(
  _prevState: ManualMemberAddFormState,
  formData: FormData,
): Promise<ManualMemberAddFormState> {
  await requireAdmin();

  const requestedYearRaw = String(formData.get("requestedYear") || "").trim();
  const requestedYear = Number.parseInt(requestedYearRaw, 10) as ManualMemberAddYear;
  const mmIdsRaw = String(formData.get("mmIds") || "").trim();

  if (![0, 14, 15].includes(requestedYear)) {
    return {
      status: "error",
      message: "기수는 운영진, 14기, 15기 중 하나여야 합니다.",
      requestedYear: 15,
      total: 0,
      success: 0,
      failed: 0,
      items: [],
    };
  }

  const inputs = parseManualMemberAddInputList(mmIdsRaw);
  if (inputs.length === 0) {
    return {
      status: "error",
      message: "추가할 MM 아이디를 콤마로 구분해 입력해 주세요.",
      requestedYear,
      total: 0,
      success: 0,
      failed: 0,
      items: [],
    };
  }

  const context = await getServerActionLogContext("/admin/members");
  const actorId = process.env.ADMIN_ID ?? "admin";
  const result = await provisionManualMembers(requestedYear, inputs);

  for (const item of result.items) {
    try {
      await logAdminAudit({
        ...context,
        action: "member_manual_add",
        actorId,
        targetType: "member",
        targetId: item.memberId ?? item.mmUserId ?? item.username,
        properties: {
          requestedYear: result.requestedYear,
          batchTotal: result.total,
          batchSuccess: result.success,
          batchFailed: result.failed,
          input: item.raw,
          normalizedUsername: item.username,
          status: item.status,
          action: item.action,
          reason: item.reason,
          resolvedYear: item.resolvedYear,
          staffSourceYear: item.staffSourceYear,
          memberId: item.memberId,
          mmUserId: item.mmUserId,
          mmUsername: item.mmUsername,
          displayName: item.displayName,
          campus: item.campus,
        },
      });
    } catch (error) {
      console.error("manual member add log failed", error);
    }
  }

  revalidateMemberPaths();
  revalidatePath("/admin/logs");

  return {
    status: result.failed > 0 ? (result.success > 0 ? "partial" : "error") : "success",
    message:
      result.success > 0
        ? `${result.success}명의 유저를 추가했습니다.`
        : "추가할 수 있는 유저가 없습니다.",
    ...result,
  };
}

export async function updateSsafyCycleSettings(formData: FormData) {
  await requireAdmin();
  const payload = parseSsafyCycleSettingsPayload(formData);
  await upsertSsafyCycleSettings(payload);
  await logAdminAction("cycle_settings_update", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: payload,
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=updated");
}

export async function earlyStartSsafyCycle() {
  await requireAdmin();
  const settings = await getSsafyCycleSettings();
  const currentYear = getConfiguredCurrentSsafyYear(settings);
  const targetYear = currentYear + 1;
  await setSsafyCycleEarlyStart(targetYear);
  await logAdminAction("cycle_settings_early_start", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: {
      currentYear,
      targetYear,
      anchorYear: settings.anchorYear,
      anchorCalendarYear: settings.anchorCalendarYear,
      anchorMonth: settings.anchorMonth,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=early-started");
}

export async function restoreSsafyCycleSettings() {
  await requireAdmin();
  const settings = await getSsafyCycleSettings();
  await clearSsafyCycleOverride();
  await logAdminAction("cycle_settings_restore", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: {
      currentYear: getConfiguredCurrentSsafyYear(settings),
      anchorYear: settings.anchorYear,
      anchorCalendarYear: settings.anchorCalendarYear,
      anchorMonth: settings.anchorMonth,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=restored");
}

export async function deleteMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("삭제할 회원을 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("mm_user_id,mm_username")
    .eq("id", id)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (!member?.mm_user_id && !member?.mm_username) {
    throw new Error("삭제할 회원을 찾을 수 없습니다.");
  }

  if (member.mm_user_id) {
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_user_id", member.mm_user_id);
    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", member.mm_user_id);
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_user_id);
  }
  if (member.mm_username && member.mm_username !== member.mm_user_id) {
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_username", member.mm_username);
    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", member.mm_username);
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_username);
  }
  const memberAuthCleanupKeys = getMemberAuthCleanupKeys([
    member.mm_user_id,
    member.mm_username,
    id,
  ]);
  if (memberAuthCleanupKeys.length > 0) {
    await supabase
      .from("member_auth_attempts")
      .delete()
      .in("identifier", memberAuthCleanupKeys);
  }

  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("member_delete", {
    targetType: "member",
    targetId: id,
    properties: {
      mmUserId: member.mm_user_id,
      mmUsername: member.mm_username,
    },
  });
  revalidateMemberPaths();
}

export async function logout() {
  await logAdminAction("logout");
  await clearAdminSession();
  redirect("/admin/login");
}
