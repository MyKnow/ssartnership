"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import { inferCampusSlugsFromLocation, normalizeCampusSlugs } from "@/lib/campuses";
import {
  sendAndRecordCampusScopedNewPartnerNotification,
} from "@/lib/new-partner-notifications";
import {
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import {
  DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
  normalizeBenefitGroupKey,
} from "@/lib/partner-branch-registration";
import { ensurePartnerCompanyRow } from "@/app/admin/(protected)/_actions/partner-support/company-provision";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getPartnerVisibilityState } from "@/lib/partner-visibility";
import {
  logAdminAction,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";

type RegistrationCompanyRelation =
  | { managed_campus_slugs?: string[] | null }
  | Array<{ managed_campus_slugs?: string[] | null }>
  | null
  | undefined;

type PartnerRegistrationRequestRow = {
  id: string;
  status: string;
  source?: string | null;
  company_id?: string | null;
  registration_mode?: string | null;
  service_mode: string;
  benefit_action_type: string;
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

type ConvertedPartnerRow = {
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

function getRegistrationCompany(company: RegistrationCompanyRelation) {
  return Array.isArray(company) ? (company[0] ?? null) : (company ?? null);
}

function resolveRegistrationManagedCampusSlugs(
  request: PartnerRegistrationRequestRow,
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

async function findExistingConvertedPartner(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  request: PartnerRegistrationRequestRow,
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

async function createPartnerFromPortalRegistrationRequest({
  supabase,
  request,
  campusSlugs,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  request: PartnerRegistrationRequestRow;
  campusSlugs: string[];
}) {
  if (!request.category_id) {
    return { partners: [], created: false };
  }

  const normalizedCampusSlugs = normalizeCampusSlugs(campusSlugs);
  if (normalizedCampusSlugs.length === 0) {
    return { partners: [], created: false };
  }

  const companyProvision = request.company_id
    ? null
    : await ensurePartnerCompanyRow(
        supabase,
        {
          companyId: null,
          name: request.company_name,
          description: request.company_description ?? null,
          contactName: request.contact_name,
          contactEmail: request.contact_email,
          contactPhone: request.contact_phone ?? null,
        },
        true,
        { managedCampusSlugs: normalizedCampusSlugs },
      );
  const companyId = request.company_id ?? companyProvision?.company?.id ?? null;
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

  let brandProfileId = (existingProfile as { id?: string } | null)?.id ?? null;
  if (!brandProfileId) {
    const { data: createdProfile, error: profileCreateError } = await supabase
      .from("partner_brand_profiles")
      .insert({
        company_id: companyId,
        name: request.brand_name,
        category_id: request.category_id,
        category_label: request.category_label,
        description: request.detail_description ?? null,
        inquiry_link: request.inquiry_link ?? null,
        brand_phone: request.brand_phone ?? null,
        thumbnail_url: request.thumbnail_url ?? null,
        image_urls: request.image_urls ?? [],
        tags: request.tags ?? [],
      })
      .select("id")
      .single();
    if (profileCreateError) {
      throw new Error(profileCreateError.message);
    }
    brandProfileId = (createdProfile as { id: string }).id;
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

  const groups = ((groupResult.data ?? []) as RegistrationBenefitGroupRow[]);
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
    const normalizedGroupKey = normalizeRegistrationBenefitGroupKey(group.group_key);
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
      ...request,
      company_id: companyId,
      brand_name: partnerName,
      location: locationSummary,
    });
    if (existingPartner) {
      createdPartners.push(existingPartner);
      continue;
    }

    const partnerId = randomUUID();
    const benefitActionType = group.benefit_action_type ?? request.benefit_action_type;
    const benefitActionLink =
      group.benefit_action_link ??
      request.benefit_action_link ??
      (benefitActionType === "external_link" ? request.site_link ?? null : null);
    const { data, error } = await supabase
      .from("partners")
      .insert({
        id: partnerId,
        company_id: companyId,
        brand_profile_id: brandProfileId,
        name: partnerName,
        category_id: request.category_id,
        location: locationSummary,
        detail_description: request.detail_description ?? null,
        campus_slugs: partnerCampusSlugs,
        managed_campus_slugs: partnerCampusSlugs,
        map_url: groupBranches[0]?.map_url ?? request.map_url ?? null,
        benefit_action_type: benefitActionType,
        benefit_action_link: benefitActionLink,
        reservation_link: null,
        inquiry_link: request.inquiry_link ?? null,
        period_start: group.period_start ?? request.period_start ?? null,
        period_end: group.period_end ?? request.period_end ?? null,
        conditions: group.conditions ?? request.conditions ?? [],
        benefits: group.benefits ?? request.benefits ?? [],
        applies_to: ["staff", "student", "graduate"],
        thumbnail: request.thumbnail_url ?? null,
        images: request.image_urls ?? [],
        tags: group.tags ?? request.tags ?? [],
        visibility: "public",
        benefit_visibility: "public",
        branch_scope_type:
          request.service_mode === "online"
            ? "online"
            : request.branch_scope_type ?? "single_location",
        branch_scope_note: request.branch_scope_note ?? null,
      })
      .select("id,name,location,campus_slugs,visibility,benefits,conditions,period_start,period_end,map_url")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const createdPartner = data as ConvertedPartnerRow;
    createdPartners.push(createdPartner);

    for (const branch of groupBranches) {
      const { data: existingBranch, error: branchLookupError } = await supabase
        .from("partner_company_branches")
        .select("id")
        .eq("company_id", companyId)
        .eq("brand_profile_id", brandProfileId)
        .eq("branch_key", branch.branch_key)
        .maybeSingle();
      if (branchLookupError) {
        throw new Error(branchLookupError.message);
      }

      let branchId = (existingBranch as { id?: string } | null)?.id ?? null;
      if (!branchId) {
        const { data: createdBranch, error: branchCreateError } = await supabase
          .from("partner_company_branches")
          .insert({
            company_id: companyId,
            brand_profile_id: brandProfileId,
            branch_key: branch.branch_key,
            branch_code: branch.branch_code ?? null,
            name: branch.name,
            address: branch.address,
            branch_type: branch.branch_type ?? "unknown",
            campus_slugs: branch.campus_slugs ?? [],
            map_url: branch.map_url ?? null,
            phone: branch.phone ?? null,
            memo: branch.memo ?? null,
            is_active: true,
          })
          .select("id")
          .single();
        if (branchCreateError) {
          throw new Error(branchCreateError.message);
        }
        branchId = (createdBranch as { id: string }).id;
      }

      const { error: offerBranchError } = await supabase
        .from("partner_offer_branches")
        .upsert(
          {
            partner_id: createdPartner.id,
            branch_id: branchId,
            status: "active",
            source: request.source === "partner_portal" ? "partner_portal" : "registration",
            memo: branch.memo ?? null,
          },
          { onConflict: "partner_id,branch_id" },
        );
      if (offerBranchError) {
        throw new Error(offerBranchError.message);
      }
    }
  }

  return { partners: createdPartners, created: createdPartners.length > 0 };
}

export async function updatePartnerRegistrationRequestStatus(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partner-registrations",
  });

  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const adminNote = String(formData.get("adminNote") || "").trim();

  if (!id || !isPartnerRegistrationRequestStatus(status)) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_registration_requests")
    .select(
      "id,status,source,company_id,registration_mode,service_mode,benefit_action_type,branch_scope_type,branch_scope_note,brand_name,category_id,category_label,period_start,period_end,inquiry_link,brand_phone,detail_description,company_name,contact_name,contact_email,contact_phone,company_description,benefits,conditions,tags,location,map_url,site_link,benefit_action_link,thumbnail_url,image_urls,company:partner_companies(managed_campus_slugs)",
    )
    .eq("id", id)
    .maybeSingle();

  if (requestError || !request) {
    return;
  }

  const registrationRequest = request as PartnerRegistrationRequestRow;
  const previousStatus = isPartnerRegistrationRequestStatus(registrationRequest.status)
    ? registrationRequest.status
    : "pending";
  const managedCampusSlugs = resolveRegistrationManagedCampusSlugs(registrationRequest);
  try {
    assertAdminCanAccessManagedCampuses(adminSession.account, managedCampusSlugs);
  } catch {
    return;
  }

  const payload: {
    status: PartnerRegistrationRequestStatus;
    admin_note: string | null;
    reviewed_by_admin_id?: string | null;
    reviewed_at?: string | null;
  } = {
    status,
    admin_note: adminNote || null,
  };

  if (status !== "pending") {
    payload.reviewed_by_admin_id = adminSession.adminId;
    payload.reviewed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("partner_registration_requests")
    .update(payload)
    .eq("id", id);
  if (updateError) {
    console.error(
      "[partner-registration] status update failed",
      updateError.message,
    );
    return;
  }

  if (status === "converted" && previousStatus !== "converted") {
    try {
      const conversion = await createPartnerFromPortalRegistrationRequest({
        supabase,
        request: registrationRequest,
        campusSlugs: managedCampusSlugs,
      });

      for (const partner of conversion.partners) {
        await logAdminAction("partner_create", {
          targetType: "partner",
          targetId: partner.id,
          properties: {
            source: "partner_registration_request",
            requestId: registrationRequest.id,
            requestSource: registrationRequest.source ?? null,
            name: partner.name,
            categoryId: registrationRequest.category_id ?? null,
            categoryLabel: registrationRequest.category_label,
            location: partner.location,
            campusSlugs: partner.campus_slugs ?? managedCampusSlugs,
            companyId: registrationRequest.company_id ?? null,
          },
        });

        if (
          getPartnerVisibilityState(
            partner.visibility === "public" ? "public" : "private",
            partner.period_start,
            partner.period_end,
          ) === "public"
        ) {
          await sendAndRecordCampusScopedNewPartnerNotification({
            partnerId: partner.id,
            name: partner.name,
            location: partner.location,
            categoryLabel: registrationRequest.category_label,
            campusSlugs: partner.campus_slugs ?? managedCampusSlugs,
            benefitSummary: (partner.benefits ?? []).join("\n"),
            conditions: (partner.conditions ?? []).join("\n"),
            periodStart: partner.period_start,
            periodEnd: partner.period_end,
            mapUrl: partner.map_url,
          });
        }

        revalidatePartnerData();
        revalidateAdminAndPublicPaths(partner.id);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "제휴처 등록 신청 승인 후처리에 실패했습니다.";
      console.error("[partner-registration] converted follow-up failed", message);
    }
  }

  revalidatePath("/admin/partner-registrations");
}
