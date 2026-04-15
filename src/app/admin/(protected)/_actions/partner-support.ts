import { randomUUID } from "node:crypto";
import { generateCode, hashCode } from "@/lib/mm-verification";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { parsePartnerMediaManifest } from "@/lib/partner-media";
import { uploadPartnerMediaFile } from "@/lib/partner-media-storage";
import { SITE_URL } from "@/lib/site";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import type {
  AdminSupabaseClient,
  PartnerAccountRow,
  PartnerCompanyInput,
  PartnerCompanyProvision,
  PartnerCompanyRow,
  PartnerMediaInput,
} from "./shared-types";

function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export function buildPartnerCompanySlug(name: string) {
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

function toPartnerAccountDisplayName(
  company: PartnerCompanyInput,
  companyRow?: PartnerCompanyRow | null,
) {
  return (
    company.contactName ||
    companyRow?.contact_name ||
    company.name ||
    companyRow?.name ||
    "제휴 담당자"
  );
}

function toPartnerAccountLoginId(
  company: PartnerCompanyInput,
  companyRow?: PartnerCompanyRow | null,
) {
  const email = company.contactEmail || companyRow?.contact_email || "";
  return normalizePartnerLoginId(email);
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

function normalizePartnerAccountRow(row: PartnerAccountRow | null | undefined) {
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

export async function issuePartnerAccountInitialSetupLink(
  supabase: AdminSupabaseClient,
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

export async function resolvePartnerMediaPayload(
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

export function collectPartnerMediaUrls(
  row?: {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null,
) {
  if (!row) {
    return [];
  }

  const urls = [row.thumbnail ?? null, ...(row.images ?? [])].filter(
    (item): item is string => Boolean(item),
  );

  return Array.from(new Set(urls));
}
