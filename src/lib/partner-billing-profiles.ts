import { randomUUID } from "node:crypto";
import {
  normalizePartnerBillingProfileInput,
  type PartnerBillingProfile,
  type PartnerBillingProfileInput,
} from "@/lib/partner-billing";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { normalizePlanUpgradePayerName } from "@/lib/partner-plan-upgrades";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const DEFAULT_BILLING_PROFILE_LABEL = "기본 세금계산서 정보";

export type PartnerBillingProfileRecord = PartnerBillingProfile & {
  id: string;
  companyId: string;
  accountId: string | null;
  label: string;
  payerName: string;
  taxDocumentType: "tax_invoice";
  isDefault: boolean;
  lastUsedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerBillingProfileFormInput = PartnerBillingProfileInput & {
  label: string;
  payerName: string;
  isDefault?: boolean;
};

export type PartnerBillingProfileFormValues = {
  id: string;
  label: string;
  payerName: string;
  businessRegistrationNumber: string;
  businessName: string;
  representativeName: string;
  businessAddress: string;
  businessType: string;
  businessItem: string;
  taxInvoiceEmail: string;
  isDefault: boolean;
};

type BillingProfileRow = {
  id: string;
  company_id: string;
  account_id?: string | null;
  label?: string | null;
  payer_name?: string | null;
  business_registration_number: string;
  business_name: string;
  representative_name: string;
  business_address: string;
  business_type: string;
  business_item: string;
  tax_invoice_email: string;
  tax_document_type?: string | null;
  is_default?: boolean | null;
  last_used_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerBillingProfiles?: PartnerBillingProfileRecord[];
};

function nowIso() {
  return new Date().toISOString();
}

export function normalizePartnerBillingProfileLabel(value: string) {
  const normalized = value.trim() || DEFAULT_BILLING_PROFILE_LABEL;
  if (normalized.length > 80) {
    throw new Error("프로필 이름은 80자 이하로 입력해 주세요.");
  }
  return normalized;
}

export function normalizePartnerBillingProfileFormInput(
  input: PartnerBillingProfileFormInput,
) {
  return {
    label: normalizePartnerBillingProfileLabel(input.label),
    payerName: normalizePlanUpgradePayerName(input.payerName),
    billingProfile: normalizePartnerBillingProfileInput(input),
    isDefault: Boolean(input.isDefault),
  };
}

function mapBillingProfileRow(
  row: BillingProfileRow,
): PartnerBillingProfileRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    accountId: row.account_id ?? null,
    label: normalizePartnerBillingProfileLabel(row.label ?? row.business_name),
    payerName: row.payer_name?.trim() || row.business_name,
    businessRegistrationNumber: row.business_registration_number,
    businessName: row.business_name,
    representativeName: row.representative_name,
    businessAddress: row.business_address,
    businessType: row.business_type,
    businessItem: row.business_item,
    taxInvoiceEmail: row.tax_invoice_email,
    taxDocumentType: "tax_invoice",
    isDefault: Boolean(row.is_default),
    lastUsedAt: row.last_used_at ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortBillingProfiles(
  profiles: PartnerBillingProfileRecord[],
): PartnerBillingProfileRecord[] {
  return [...profiles].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1;
    }
    const aTime = new Date(a.lastUsedAt ?? a.updatedAt).getTime();
    const bTime = new Date(b.lastUsedAt ?? b.updatedAt).getTime();
    return bTime - aTime;
  });
}

export function isPartnerBillingProfileVisibleInCompanyScope(
  profile: Pick<
    PartnerBillingProfileRecord,
    "accountId" | "companyId" | "archivedAt"
  >,
  input: { accountId: string; companyId: string },
) {
  if (profile.archivedAt) {
    return false;
  }
  if (profile.accountId === input.accountId) {
    return true;
  }
  return profile.accountId === null && profile.companyId === input.companyId;
}

function createMockSeedProfiles() {
  const createdAt = "2026-07-03T00:00:00.000Z";
  return [
    {
      id: "mock-billing-profile-cafe-haeon-default",
      companyId: "mock-partner-company-cafe-haeon",
      accountId: "mock-partner-account-cafe-haeon",
      label: "카페 해온 본점",
      payerName: "카페해온",
      businessRegistrationNumber: "2208162517",
      businessName: "카페해온",
      representativeName: "김도연",
      businessAddress: "서울 강남구 역삼로 123",
      businessType: "음식점업",
      businessItem: "커피",
      taxInvoiceEmail: "tax@cafehaeon.example",
      taxDocumentType: "tax_invoice",
      isDefault: true,
      lastUsedAt: null,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ] satisfies PartnerBillingProfileRecord[];
}

function getMockBillingProfiles() {
  if (!globalScope.__mockPartnerBillingProfiles) {
    globalScope.__mockPartnerBillingProfiles = createMockSeedProfiles();
  }
  return globalScope.__mockPartnerBillingProfiles;
}

function updateMockBillingProfiles(
  updater: (
    profiles: PartnerBillingProfileRecord[],
  ) => PartnerBillingProfileRecord[],
) {
  globalScope.__mockPartnerBillingProfiles = updater(getMockBillingProfiles());
}

async function assertSupabaseAccountCompanyAccess(input: {
  accountId: string;
  companyId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_account_companies")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("company_id", input.companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error("협력사 접근 권한이 없습니다.");
  }
}

export function toPartnerBillingProfileFormValues(
  profile: PartnerBillingProfileRecord,
): PartnerBillingProfileFormValues {
  return {
    id: profile.id,
    label: profile.label,
    payerName: profile.payerName,
    businessRegistrationNumber: profile.businessRegistrationNumber,
    businessName: profile.businessName,
    representativeName: profile.representativeName,
    businessAddress: profile.businessAddress,
    businessType: profile.businessType,
    businessItem: profile.businessItem,
    taxInvoiceEmail: profile.taxInvoiceEmail,
    isDefault: profile.isDefault,
  };
}

export async function getPartnerBillingProfiles(input: {
  accountId: string;
  companyId: string;
}) {
  if (isPartnerPortalMock) {
    return sortBillingProfiles(
      getMockBillingProfiles().filter((profile) =>
        isPartnerBillingProfileVisibleInCompanyScope(profile, input),
      ),
    );
  }

  await assertSupabaseAccountCompanyAccess(input);
  const supabase = getSupabaseAdminClient();
  const selectColumns =
    "id,company_id,account_id,label,payer_name,business_registration_number,business_name,representative_name,business_address,business_type,business_item,tax_invoice_email,tax_document_type,is_default,last_used_at,archived_at,created_at,updated_at";
  const [accountProfilesResult, legacyCompanyProfilesResult] =
    await Promise.all([
      supabase
        .from("partner_billing_profiles")
        .select(selectColumns)
        .eq("account_id", input.accountId)
        .is("archived_at", null),
      supabase
        .from("partner_billing_profiles")
        .select(selectColumns)
        .eq("company_id", input.companyId)
        .is("account_id", null)
        .is("archived_at", null),
    ]);

  if (accountProfilesResult.error) {
    throw new Error(accountProfilesResult.error.message);
  }
  if (legacyCompanyProfilesResult.error) {
    throw new Error(legacyCompanyProfilesResult.error.message);
  }

  const profileRows = [
    ...((accountProfilesResult.data ?? []) as BillingProfileRow[]),
    ...((legacyCompanyProfilesResult.data ?? []) as BillingProfileRow[]),
  ];
  const profilesById = new Map(
    profileRows.map((row) => [row.id, mapBillingProfileRow(row)]),
  );

  return sortBillingProfiles([...profilesById.values()]);
}

async function unsetOtherDefaultProfiles(input: {
  accountId: string;
  companyId: string;
  exceptProfileId?: string;
}) {
  if (isPartnerPortalMock) {
    updateMockBillingProfiles((profiles) =>
      profiles.map((profile) =>
        profile.accountId === input.accountId &&
        !profile.archivedAt &&
        profile.id !== input.exceptProfileId
          ? { ...profile, isDefault: false }
          : profile,
      ),
    );
    return;
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("partner_billing_profiles")
    .update({ is_default: false })
    .eq("account_id", input.accountId)
    .is("archived_at", null);
  if (input.exceptProfileId) {
    query = query.neq("id", input.exceptProfileId);
  }
  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

export async function createPartnerBillingProfile(input: {
  accountId: string;
  companyId: string;
  form: PartnerBillingProfileFormInput;
}) {
  const normalized = normalizePartnerBillingProfileFormInput(input.form);
  const existingProfiles = await getPartnerBillingProfiles(input);
  const shouldBeDefault =
    normalized.isDefault ||
    existingProfiles.every((profile) => profile.accountId !== input.accountId);
  const createdAt = nowIso();

  if (shouldBeDefault) {
    await unsetOtherDefaultProfiles(input);
  }

  if (isPartnerPortalMock) {
    const profile: PartnerBillingProfileRecord = {
      id: randomUUID(),
      companyId: input.companyId,
      accountId: input.accountId,
      label: normalized.label,
      payerName: normalized.payerName,
      ...normalized.billingProfile,
      taxDocumentType: "tax_invoice",
      isDefault: shouldBeDefault,
      lastUsedAt: null,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    updateMockBillingProfiles((profiles) => [...profiles, profile]);
    return profile;
  }

  await assertSupabaseAccountCompanyAccess(input);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_billing_profiles")
    .insert({
      account_id: input.accountId,
      company_id: input.companyId,
      label: normalized.label,
      payer_name: normalized.payerName,
      business_registration_number:
        normalized.billingProfile.businessRegistrationNumber,
      business_name: normalized.billingProfile.businessName,
      representative_name: normalized.billingProfile.representativeName,
      business_address: normalized.billingProfile.businessAddress,
      business_type: normalized.billingProfile.businessType,
      business_item: normalized.billingProfile.businessItem,
      tax_invoice_email: normalized.billingProfile.taxInvoiceEmail,
      tax_document_type: "tax_invoice",
      is_default: shouldBeDefault,
    })
    .select(
      "id,company_id,account_id,label,payer_name,business_registration_number,business_name,representative_name,business_address,business_type,business_item,tax_invoice_email,tax_document_type,is_default,last_used_at,archived_at,created_at,updated_at",
    )
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "프로필을 저장하지 못했습니다.");
  }
  return mapBillingProfileRow(data as BillingProfileRow);
}

async function getAccessibleProfile(input: {
  accountId: string;
  companyId: string;
  profileId: string;
}) {
  const profiles = await getPartnerBillingProfiles(input);
  const profile = profiles.find((item) => item.id === input.profileId) ?? null;
  if (!profile) {
    throw new Error("프로필을 찾을 수 없습니다.");
  }
  return profile;
}

export async function setDefaultPartnerBillingProfile(input: {
  accountId: string;
  companyId: string;
  profileId: string;
}) {
  const profile = await getAccessibleProfile(input);
  if (profile.accountId !== input.accountId) {
    throw new Error(
      "기존 협력사 정보는 기본값으로 지정할 수 없습니다. 새 프로필로 저장해 주세요.",
    );
  }

  await unsetOtherDefaultProfiles({
    accountId: input.accountId,
    companyId: input.companyId,
    exceptProfileId: input.profileId,
  });

  if (isPartnerPortalMock) {
    const updatedAt = nowIso();
    updateMockBillingProfiles((profiles) =>
      profiles.map((item) =>
        item.id === input.profileId
          ? { ...item, isDefault: true, updatedAt }
          : item,
      ),
    );
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_billing_profiles")
    .update({ is_default: true })
    .eq("id", input.profileId)
    .eq("account_id", input.accountId)
    .is("archived_at", null);
  if (error) {
    throw new Error(error.message);
  }
}

export async function archivePartnerBillingProfile(input: {
  accountId: string;
  companyId: string;
  profileId: string;
}) {
  const profile = await getAccessibleProfile(input);
  if (profile.accountId !== input.accountId) {
    throw new Error("기존 협력사 정보는 삭제할 수 없습니다.");
  }
  const archivedAt = nowIso();

  if (isPartnerPortalMock) {
    updateMockBillingProfiles((profiles) =>
      profiles.map((item) =>
        item.id === input.profileId
          ? {
              ...item,
              archivedAt,
              isDefault: false,
              updatedAt: archivedAt,
            }
          : item,
      ),
    );
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_billing_profiles")
    .update({ archived_at: archivedAt, is_default: false })
    .eq("id", input.profileId)
    .eq("account_id", input.accountId)
    .is("archived_at", null);
  if (error) {
    throw new Error(error.message);
  }
}

export async function resolvePartnerBillingProfileForPlanRequest(input: {
  accountId: string;
  companyId: string;
  billingProfileId: string;
}) {
  const profile = await getAccessibleProfile({
    accountId: input.accountId,
    companyId: input.companyId,
    profileId: input.billingProfileId,
  });
  const lastUsedAt = nowIso();

  if (isPartnerPortalMock) {
    updateMockBillingProfiles((profiles) =>
      profiles.map((item) =>
        item.id === input.billingProfileId
          ? { ...item, lastUsedAt, updatedAt: lastUsedAt }
          : item,
      ),
    );
  } else {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("partner_billing_profiles")
      .update({ last_used_at: lastUsedAt })
      .eq("id", input.billingProfileId)
      .is("archived_at", null);

    if (profile.accountId === input.accountId) {
      query = query.eq("account_id", input.accountId);
    } else {
      query = query.eq("company_id", input.companyId).is("account_id", null);
    }

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    profileId: profile.id,
    payerName: normalizePlanUpgradePayerName(profile.payerName),
    billingProfile: {
      businessRegistrationNumber: profile.businessRegistrationNumber,
      businessName: profile.businessName,
      representativeName: profile.representativeName,
      businessAddress: profile.businessAddress,
      businessType: profile.businessType,
      businessItem: profile.businessItem,
      taxInvoiceEmail: profile.taxInvoiceEmail,
    } satisfies PartnerBillingProfile,
  };
}
