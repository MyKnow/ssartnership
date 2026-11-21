import { logServerError } from "@/lib/server-log";
import {
  awaitPartnerMutation,
  PartnerMutationCleanupError,
  PartnerMutationOutcomeUnknownError,
  requirePartnerMutationReceipt,
  requirePartnerMutationRow,
} from "@/lib/partner-admin/mutation-outcome";
import "server-only";

import { randomUUID } from "node:crypto";
import {
  inferCampusSlugsFromLocation,
  normalizeCampusSlugs,
} from "@/lib/campuses";
import { buildPartnerInsertRow } from "@/lib/partner-admin/partner-insert-row";
import { normalizePartnerBenefitItems } from "@/lib/partner-benefit-items";
import { persistPartnerBranchLinks } from "@/lib/partner-branch-links.server";
import {
  DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
  normalizeBenefitGroupKey,
} from "@/lib/partner-branch-registration";
import {
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import { isPartnerVisibility } from "@/lib/partner-visibility";
import type { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Converts an approved partner registration request into partner rows.
 *
 * The pipeline is shared by the admin registration queue. It keeps the
 * compensation order explicit so a partial failure removes only the rows this
 * attempt created: partners → brand profile → company provisioning.
 */

export type RegistrationConversionSupabaseClient = ReturnType<
  typeof getSupabaseAdminClient
>;

/** Partial conversion resources may remain; automatic retry is unsafe. */
export class PartnerRegistrationConversionCleanupError extends PartnerMutationCleanupError {
  constructor(cause: { originalError: unknown; cleanupError: unknown }) {
    super("partner_registration_conversion_cleanup_failed", cause);
    this.name = "PartnerRegistrationConversionCleanupError";
  }
}

type RegistrationCompanyRelation =
  | { managed_campus_slugs?: string[] | null }
  | Array<{ managed_campus_slugs?: string[] | null }>
  | null
  | undefined;

export type PartnerRegistrationRequestRow = {
  id: string;
  status: string;
  visibility?: string | null;
  admin_note?: string | null;
  reviewed_by_admin_id?: string | null;
  reviewed_at?: string | null;
  source?: string | null;
  company_id?: string | null;
  registration_mode?: string | null;
  service_mode: string;
  benefit_action_type: string;
  benefit_items?: unknown;
  benefit_verification_pin_hash?: string | null;
  benefit_verification_pin_salt?: string | null;
  branch_scope_type?: string | null;
  branch_scope_note?: string | null;
  brand_name: string;
  category_id?: string | null;
  category_label: string;
  period_start?: string | null;
  period_end?: string | null;
  inquiry_link?: string | null;
  detail_description?: string | null;
  brand_phone?: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  company_description?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  tags?: string[] | null;
  location: string;
  map_url?: string | null;
  site_link?: string | null;
  benefit_action_link?: string | null;
  thumbnail_url?: string | null;
  image_urls?: string[] | null;
  company?: RegistrationCompanyRelation;
};

export type ConvertedPartnerRow = {
  id: string;
  name: string;
  location: string;
  campus_slugs?: string[] | null;
  visibility?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  period_start?: string | null;
  period_end?: string | null;
  map_url?: string | null;
};

type RegistrationBenefitGroupRow = {
  group_key: string;
  label: string;
  benefit_action_type?: string | null;
  benefit_action_link?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  period_start?: string | null;
  period_end?: string | null;
  tags?: string[] | null;
};

type RegistrationBranchRow = {
  benefit_group_key?: string | null;
  branch_key: string;
  branch_code?: string | null;
  name: string;
  address: string;
  branch_type?: string | null;
  campus_slugs?: string[] | null;
  map_url?: string | null;
  phone?: string | null;
  memo?: string | null;
};

export type RegistrationCompanyInput = {
  companyId: string | null;
  name: string;
  description: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
};

export type RegistrationCompanyProvision = {
  company?: { id: string } | null;
};

/**
 * Company provisioning stays owned by the admin action layer. The conversion
 * pipeline receives it as a dependency so this module does not import from
 * `src/app` and tests can observe the compensation order.
 */
export type RegistrationCompanyProvisioner<
  TProvision extends RegistrationCompanyProvision,
> = {
  ensure: (
    supabase: RegistrationConversionSupabaseClient,
    input: RegistrationCompanyInput,
    options: { managedCampusSlugs: string[] },
  ) => Promise<TProvision>;
  cleanup: (
    supabase: RegistrationConversionSupabaseClient,
    provision: TProvision | null,
  ) => Promise<void>;
};

export type RegistrationConversionResources<
  TProvision extends RegistrationCompanyProvision,
> = {
  companyProvision: TProvision | null;
  createdBrandProfileId: string | null;
  createdPartnerIds: string[];
};

export type RegistrationConversionResult = {
  partners: ConvertedPartnerRow[];
  created: boolean;
};

function getRegistrationCompany(company: RegistrationCompanyRelation) {
  return Array.isArray(company) ? (company[0] ?? null) : (company ?? null);
}

export function resolveRegistrationManagedCampusSlugs(
  request: Pick<PartnerRegistrationRequestRow, "company" | "location">,
) {
  const company = getRegistrationCompany(request.company);
  return normalizeCampusSlugs(
    company?.managed_campus_slugs ??
      inferCampusSlugsFromLocation(request.location),
  );
}

function normalizeRegistrationBenefitGroupKey(value?: string | null) {
  return normalizeBenefitGroupKey(value, DEFAULT_PARTNER_BENEFIT_GROUP_KEY);
}

export async function rollbackRegistrationConversionResources<
  TProvision extends RegistrationCompanyProvision,
>(
  supabase: RegistrationConversionSupabaseClient,
  resources: RegistrationConversionResources<TProvision>,
  companyProvisioner: RegistrationCompanyProvisioner<TProvision>,
) {
  const cleanupFailures: Array<{
    stage: string;
    code?: string;
    message: string;
  }> = [];

  if (resources.createdPartnerIds.length > 0) {
    const { data, error } = await awaitPartnerMutation(supabase
      .from("partners")
      .delete()
      .in("id", resources.createdPartnerIds)
      .select("id"), "conversion_partner_cleanup");
    if (error) {
      cleanupFailures.push({
        stage: "partners",
        code: error.code,
        message: error.message,
      });
    } else {
      requirePartnerMutationReceipt(data, resources.createdPartnerIds.map((id) => ({ id })), "conversion_partner_cleanup");
    }
  }

  if (resources.createdBrandProfileId) {
    const { data, error } = await awaitPartnerMutation(supabase
      .from("partner_brand_profiles")
      .delete()
      .eq("id", resources.createdBrandProfileId)
      .select("id"), "conversion_brand_cleanup");
    if (error) {
      cleanupFailures.push({
        stage: "partner_brand_profile",
        code: error.code,
        message: error.message,
      });
    } else {
      requirePartnerMutationReceipt(data, [{ id: resources.createdBrandProfileId }], "conversion_brand_cleanup");
    }
  }

  await companyProvisioner
    .cleanup(supabase, resources.companyProvision)
    .catch((error: unknown) => {
      if (error instanceof PartnerMutationOutcomeUnknownError) throw error;
      cleanupFailures.push({
        stage: "partner_company_provision",
        message:
          error instanceof Error ? error.message : "unknown cleanup error",
      });
    });

  if (cleanupFailures.length > 0) {
    logServerError("[partner-registration] conversion rollback failed", new Error("rollback_failed"), {
      stages: cleanupFailures.map(({ stage }) => stage),
    });
    throw new Error("partner_registration_conversion_cleanup_failed");
  }
}

export async function findExistingConvertedPartner(
  supabase: RegistrationConversionSupabaseClient,
  request: Pick<
    PartnerRegistrationRequestRow,
    "brand_name" | "location" | "company_id"
  >,
) {
  let query = supabase
    .from("partners")
    .select("id,name,location,campus_slugs,visibility")
    .eq("name", request.brand_name)
    .eq("location", request.location)
    .limit(1);

  if (request.company_id) {
    query = query.eq("company_id", request.company_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? null) as ConvertedPartnerRow | null;
}

export async function createPartnerFromPortalRegistrationRequest<
  TProvision extends RegistrationCompanyProvision,
>({
  supabase,
  request,
  campusSlugs,
  companyProvisioner,
}: {
  supabase: RegistrationConversionSupabaseClient;
  request: PartnerRegistrationRequestRow;
  campusSlugs: string[];
  companyProvisioner: RegistrationCompanyProvisioner<TProvision>;
}): Promise<RegistrationConversionResult> {
  const categoryId = request.category_id;
  if (!categoryId) {
    return { partners: [], created: false };
  }

  const normalizedCampusSlugs = normalizeCampusSlugs(campusSlugs);
  if (normalizedCampusSlugs.length === 0) {
    return { partners: [], created: false };
  }

  const resources: RegistrationConversionResources<TProvision> = {
    companyProvision: null,
    createdBrandProfileId: null,
    createdPartnerIds: [],
  };

  try {
    resources.companyProvision = request.company_id
      ? null
      : await companyProvisioner.ensure(
          supabase,
          {
            companyId: null,
            name: request.company_name,
            description: request.company_description ?? null,
            contactName: request.contact_name,
            contactEmail: request.contact_email,
            contactPhone: request.contact_phone ?? null,
          },
          { managedCampusSlugs: normalizedCampusSlugs },
        );
    const companyId =
      request.company_id ?? resources.companyProvision?.company?.id ?? null;
    if (!companyId) {
      return { partners: [], created: false };
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("partner_brand_profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", request.brand_name)
      .maybeSingle();
    if (profileLookupError) {
      throw new Error(profileLookupError.message);
    }

    let brandProfileId =
      (existingProfile as { id?: string } | null)?.id ?? null;
    if (!brandProfileId) {
      const { data: createdProfile, error: profileCreateError } =
        await awaitPartnerMutation(supabase
          .from("partner_brand_profiles")
          .insert({
            company_id: companyId,
            name: request.brand_name,
            category_id: categoryId,
            category_label: request.category_label,
            description: request.detail_description ?? null,
            inquiry_link: request.inquiry_link ?? null,
            brand_phone: request.brand_phone ?? null,
            thumbnail_url: request.thumbnail_url ?? null,
            image_urls: request.image_urls ?? [],
            tags: request.tags ?? [],
          })
          .select("id,company_id,name")
          .single(), "conversion_brand_insert");
      if (profileCreateError) {
        throw new Error(profileCreateError.message);
      }
      requirePartnerMutationRow(createdProfile, { company_id: companyId, name: request.brand_name }, "conversion_brand_insert");
      brandProfileId = (createdProfile as { id: string }).id;
      resources.createdBrandProfileId = brandProfileId;
    }

    const [groupResult, branchResult] = await Promise.all([
      supabase
        .from("partner_registration_benefit_groups")
        .select("group_key,label,benefit_action_type,benefit_action_link,benefits,conditions,period_start,period_end,tags")
        .eq("registration_request_id", request.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("partner_registration_branches")
        .select("benefit_group_key,branch_key,branch_code,name,address,branch_type,campus_slugs,map_url,phone,memo")
        .eq("registration_request_id", request.id)
        .order("created_at", { ascending: true }),
    ]);
    if (groupResult.error) {
      throw new Error(groupResult.error.message);
    }
    if (branchResult.error) {
      throw new Error(branchResult.error.message);
    }

    const groups = (groupResult.data ?? []) as RegistrationBenefitGroupRow[];
    const safeGroups =
      groups.length > 0
        ? groups
        : [
            {
              group_key: DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
              label: DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
              benefit_action_type: request.benefit_action_type,
              benefit_action_link: request.benefit_action_link,
              benefits: request.benefits ?? [],
              conditions: request.conditions ?? [],
              period_start: request.period_start ?? null,
              period_end: request.period_end ?? null,
              tags: request.tags ?? [],
            },
          ];
    const branches = (branchResult.data ?? []) as RegistrationBranchRow[];
    const createdPartners: ConvertedPartnerRow[] = [];

    for (const group of safeGroups) {
      const normalizedGroupKey = normalizeRegistrationBenefitGroupKey(
        group.group_key,
      );
      const groupBranches = branches.filter(
        (branch) =>
          normalizeRegistrationBenefitGroupKey(branch.benefit_group_key) ===
          normalizedGroupKey,
      );
      const groupCampusSlugs = normalizeCampusSlugs(
        groupBranches.flatMap((branch) => branch.campus_slugs ?? []),
      );
      const partnerCampusSlugs =
        groupCampusSlugs.length > 0 ? groupCampusSlugs : normalizedCampusSlugs;
      const locationSummary =
        groupBranches.length === 0
          ? request.location
          : groupBranches.length === 1
            ? groupBranches[0]!.address
            : `${groupBranches[0]!.address} 외 ${groupBranches.length - 1}개 지점`;
      const partnerName =
        safeGroups.length === 1 ||
        normalizedGroupKey === DEFAULT_PARTNER_BENEFIT_GROUP_KEY
          ? request.brand_name
          : `${request.brand_name} · ${group.label}`;
      const existingPartner = await findExistingConvertedPartner(supabase, {
        company_id: companyId,
        brand_name: partnerName,
        location: locationSummary,
      });
      if (existingPartner) {
        createdPartners.push(existingPartner);
        continue;
      }

      const partnerId = randomUUID();
      const benefitActionType =
        group.benefit_action_type ?? request.benefit_action_type;
      const benefitActionLink =
        group.benefit_action_link ??
        request.benefit_action_link ??
        (benefitActionType === "external_link"
          ? request.site_link ?? null
          : null);
      const { data, error } = await awaitPartnerMutation(supabase
        .from("partners")
        .insert(
          buildPartnerInsertRow({
            id: partnerId,
            companyId,
            brandProfileId,
            name: partnerName,
            categoryId,
            location: locationSummary,
            detailDescription: request.detail_description ?? null,
            campusSlugs: partnerCampusSlugs,
            managedCampusSlugs: partnerCampusSlugs,
            mapUrl: groupBranches[0]?.map_url ?? request.map_url ?? null,
            benefitActionType,
            benefitActionLink,
            benefitVerificationPinHash:
              request.benefit_verification_pin_hash ?? null,
            benefitVerificationPinSalt:
              request.benefit_verification_pin_salt ?? null,
            reservationLink: null,
            inquiryLink: request.inquiry_link ?? null,
            periodStart: group.period_start ?? request.period_start ?? null,
            periodEnd: group.period_end ?? request.period_end ?? null,
            conditions: group.conditions ?? request.conditions ?? [],
            benefits: group.benefits ?? request.benefits ?? [],
            appliesTo: ["staff", "student", "graduate"],
            thumbnail: request.thumbnail_url ?? null,
            images: request.image_urls ?? [],
            tags: group.tags ?? request.tags ?? [],
            visibility: request.visibility ?? "public",
            benefitVisibility: "public",
            branchScopeType:
              request.service_mode === "online"
                ? "online"
                : request.branch_scope_type ?? "single_location",
            branchScopeNote: request.branch_scope_note ?? null,
          }),
        )
        .select("id,name,location,campus_slugs,visibility,benefits,conditions,period_start,period_end,map_url")
        .single(), "conversion_partner_insert");

      if (error) {
        throw new Error(error.message);
      }

      requirePartnerMutationRow(data, { id: partnerId, name: partnerName, location: locationSummary }, "conversion_partner_insert");

      const createdPartner = data as ConvertedPartnerRow;
      createdPartners.push(createdPartner);
      resources.createdPartnerIds.push(createdPartner.id);

      const benefitItems = normalizePartnerBenefitItems(
        request.benefit_items ??
          (group.benefits ?? request.benefits ?? []).map((title, index) => ({
            id: `registration-benefit-${index + 1}`,
            title,
          })),
      );
      if (benefitItems.length > 0) {
        const benefitRows = benefitItems.map((benefit, displayOrder) => ({
          partner_id: partnerId,
          title: benefit.title,
          max_apply_count: benefit.maxApplyCount ?? null,
          display_order: displayOrder,
        }));
        const { data: createdBenefitRows, error: benefitError } = await awaitPartnerMutation(supabase
          .from("partner_benefits")
          .insert(benefitRows)
          .select("partner_id,title,max_apply_count,display_order"), "conversion_benefit_insert");
        if (benefitError) {
          throw new Error(benefitError.message);
        }
        requirePartnerMutationReceipt(createdBenefitRows, benefitRows, "conversion_benefit_insert");
      }

      await persistPartnerBranchLinks({
        supabase,
        partnerId: createdPartner.id,
        companyId,
        brandProfileId,
        source:
          request.source === "partner_portal" ? "partner_portal" : "registration",
        branches: groupBranches.map((branch) => ({
          branchKey: branch.branch_key,
          branchCode: branch.branch_code ?? null,
          name: branch.name,
          address: branch.address,
          branchType: branch.branch_type ?? "unknown",
          campusSlugs: branch.campus_slugs ?? [],
          mapUrl: branch.map_url ?? null,
          phone: branch.phone ?? null,
          memo: branch.memo ?? null,
        })),
      });
    }

    return { partners: createdPartners, created: createdPartners.length > 0 };
  } catch (error) {
    if (error instanceof PartnerMutationOutcomeUnknownError) throw error;
    if (error instanceof PartnerMutationCleanupError) {
      throw new PartnerRegistrationConversionCleanupError(error.cause);
    }
    try {
      await rollbackRegistrationConversionResources(
        supabase,
        resources,
        companyProvisioner,
      );
    } catch (cleanupError) {
      if (cleanupError instanceof PartnerMutationOutcomeUnknownError) throw cleanupError;
      throw new PartnerRegistrationConversionCleanupError({
        originalError: error,
        cleanupError,
      });
    }
    throw error;
  }
}

/**
 * Restores the request row only while it still holds the status this attempt
 * wrote, so a concurrent reviewer's newer decision is never overwritten.
 */
export async function rollbackPartnerRegistrationRequestStatus({
  supabase,
  request,
  requestedStatus,
}: {
  supabase: RegistrationConversionSupabaseClient;
  request: PartnerRegistrationRequestRow;
  requestedStatus: PartnerRegistrationRequestStatus;
}) {
  const previousStatus = isPartnerRegistrationRequestStatus(request.status)
    ? request.status
    : "pending";
  const previousVisibility =
    typeof request.visibility === "string" &&
    isPartnerVisibility(request.visibility)
      ? request.visibility
      : "public";
  const { data, error } = await supabase
    .from("partner_registration_requests")
    .update({
      status: previousStatus,
      visibility: previousVisibility,
      admin_note: request.admin_note ?? null,
      reviewed_by_admin_id: request.reviewed_by_admin_id ?? null,
      reviewed_at: request.reviewed_at ?? null,
    })
    .eq("id", request.id)
    .eq("status", requestedStatus)
    .select("id")
    .maybeSingle();

  return !error && data !== null && typeof data === "object" && !Array.isArray(data) && data.id === request.id;
}
