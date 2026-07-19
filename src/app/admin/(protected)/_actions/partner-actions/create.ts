import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  assertAdminCanAccessManagedCampuses,
  type AdminScopeAccountLike,
  resolveCreatedManagedCampusSlugs,
} from "@/lib/admin-scope";
import { sendCampusScopedNewPartnerNotification } from "@/lib/new-partner-notifications";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import {
  DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
  createFallbackSingleBranch,
  getDefaultBranchTypeForScope,
  inferPartnerBranchScopeType,
  isMultiBranchScopeType,
  normalizePartnerBranchScopeType,
  parsePartnerBranchListText,
  type PartnerBranchDraft,
  type PartnerBranchScopeType,
} from "@/lib/partner-branch-registration";
import type { PartnerCreateFormState } from "@/lib/partner-form-state";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  cleanupPartnerCompanyProvision,
  ensurePartnerCompanyRow,
  resolvePartnerMediaPayload,
} from "@/app/admin/(protected)/_actions/partner-support";
import {
  logAdminAction,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import {
  parsePartnerCompanyPayload,
  parsePartnerPayload,
} from "@/app/admin/(protected)/_actions/shared-parsers";
import type { CreatedPartnerRecord } from "@/app/admin/(protected)/_actions/shared-types";
import { readFormIdempotencyKey } from "@/lib/form-idempotency";

type AdminPartnerBranchPayload = {
  branchScopeType: PartnerBranchScopeType;
  branchScopeNote: string | null;
  branches: PartnerBranchDraft[];
};

function parseAdminPartnerBranchPayload({
  formData,
  payload,
  companyName,
}: {
  formData: FormData;
  payload: ReturnType<typeof parsePartnerPayload>;
  companyName: string;
}): AdminPartnerBranchPayload {
  const serviceMode =
    String(formData.get("serviceMode") || "").trim() === "online"
      ? "online"
      : "offline";
  const requestedScopeType = normalizePartnerBranchScopeType(
    String(formData.get("branchScopeType") || "").trim(),
    serviceMode,
  );
  const branchScopeNote = String(formData.get("branchScopeNote") || "").trim();
  const branchListText = String(formData.get("branchListText") || "").trim();
  const branchContext = {
    companyName,
    brandName: payload.name,
    defaultBenefitGroupKey: DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
    defaultBranchType: getDefaultBranchTypeForScope(requestedScopeType),
  };
  const branchTextResult = branchListText
    ? parsePartnerBranchListText(branchListText, branchContext)
    : { branches: [] as PartnerBranchDraft[], errors: [] as string[] };
  if (branchTextResult.errors.length > 0) {
    throw new Error("partner_form_invalid_branch_list");
  }

  const shouldRequireBranchList =
    serviceMode === "offline" && isMultiBranchScopeType(requestedScopeType);
  if (shouldRequireBranchList && branchTextResult.branches.length === 0) {
    throw new Error("partner_form_invalid_branch_list");
  }

  const fallbackBranchResult =
    serviceMode === "offline" &&
    !shouldRequireBranchList &&
    branchTextResult.branches.length === 0 &&
    payload.location
      ? createFallbackSingleBranch({
          companyName,
          brandName: payload.name,
          location: payload.location,
          mapUrl: payload.mapUrl,
        })
      : null;
  if (fallbackBranchResult?.errors.length) {
    throw new Error("partner_form_invalid_branch_list");
  }

  const branches =
    serviceMode === "online"
      ? []
      : branchTextResult.branches.length > 0
        ? branchTextResult.branches
        : (fallbackBranchResult?.branches ?? []);
  return {
    branchScopeType: inferPartnerBranchScopeType({
      serviceMode,
      branches,
      fallback: requestedScopeType,
    }),
    branchScopeNote: branchScopeNote || null,
    branches,
  };
}

async function ensureAdminPartnerBrandProfile({
  supabase,
  companyId,
  payload,
  media,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  companyId: string;
  payload: ReturnType<typeof parsePartnerPayload>;
  media: { thumbnail: string | null; images: string[] };
}) {
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("partner_brand_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", payload.name)
    .maybeSingle();
  if (profileLookupError) {
    throw new Error(profileLookupError.message);
  }
  const existingProfileId =
    (existingProfile as { id?: string } | null)?.id ?? null;
  if (existingProfileId) {
    return { brandProfileId: existingProfileId, created: false };
  }

  const { data: createdProfile, error: profileCreateError } = await supabase
    .from("partner_brand_profiles")
    .insert({
      company_id: companyId,
      name: payload.name,
      category_id: payload.categoryId,
      description: payload.detailDescription,
      inquiry_link: payload.inquiryLink,
      thumbnail_url: media.thumbnail,
      image_urls: media.images,
      tags: payload.tags,
    })
    .select("id")
    .single();
  if (profileCreateError) {
    throw new Error(profileCreateError.message);
  }
  return {
    brandProfileId: (createdProfile as { id: string }).id,
    created: true,
  };
}

async function persistAdminPartnerBranchLinks({
  supabase,
  partnerId,
  companyId,
  brandProfileId,
  branches,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  partnerId: string;
  companyId: string | null;
  brandProfileId: string | null;
  branches: PartnerBranchDraft[];
}) {
  if (!companyId || !brandProfileId || branches.length === 0) {
    return;
  }

  for (const branch of branches) {
    const { data: existingBranch, error: branchLookupError } = await supabase
      .from("partner_company_branches")
      .select("id")
      .eq("company_id", companyId)
      .eq("brand_profile_id", brandProfileId)
      .eq("branch_key", branch.branchKey)
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
          branch_key: branch.branchKey,
          branch_code: branch.branchCode,
          name: branch.branchName,
          address: branch.address,
          branch_type: branch.branchType,
          campus_slugs: branch.campusSlugs,
          map_url: branch.mapUrl,
          phone: branch.phone,
          memo: branch.memo,
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
          partner_id: partnerId,
          branch_id: branchId,
          status: "active",
          source: "admin",
          memo: branch.memo,
        },
        { onConflict: "partner_id,branch_id" },
      );
    if (offerBranchError) {
      throw new Error(offerBranchError.message);
    }
  }
}

async function createPartnerRecord(
  formData: FormData,
  adminAccount: AdminScopeAccountLike,
): Promise<CreatedPartnerRecord> {
  const partnerId = readFormIdempotencyKey(formData);
  if (!partnerId) {
    throw new Error("partner_form_invalid_submission");
  }
  const payload = parsePartnerPayload(formData);
  const companyPayload = parsePartnerCompanyPayload(formData);
  const media = await resolvePartnerMediaPayload(formData, partnerId);
  const managedCampusSlugs = resolveCreatedManagedCampusSlugs(
    adminAccount,
    payload.campusSlugs,
  );

  const supabase = getSupabaseAdminClient();
  let companyProvision = null;
  let createdBrandProfileId: string | null = null;
  let createdPartner = false;

  try {
    companyProvision = await ensurePartnerCompanyRow(
      supabase,
      companyPayload,
      false,
      { managedCampusSlugs },
    );
    if (companyProvision?.company) {
      assertAdminCanAccessManagedCampuses(
        adminAccount,
        companyProvision.company.managed_campus_slugs,
      );
    }
    const companyName =
      companyProvision?.company?.name || companyPayload.name || payload.name;
    const branchPayload = parseAdminPartnerBranchPayload({
      formData,
      payload,
      companyName,
    });
    const brandProfile =
      companyProvision?.company?.id
        ? await ensureAdminPartnerBrandProfile({
            supabase,
            companyId: companyProvision.company.id,
            payload,
            media,
          })
        : { brandProfileId: null, created: false };
    if (brandProfile.created) {
      createdBrandProfileId = brandProfile.brandProfileId;
    }

    const { error } = await supabase.from("partners").insert({
      id: partnerId,
      company_id: companyProvision.company?.id ?? null,
      brand_profile_id: brandProfile.brandProfileId,
      name: payload.name,
      category_id: payload.categoryId,
      location: payload.location,
      detail_description: payload.detailDescription,
      campus_slugs: payload.campusSlugs,
      map_url: payload.mapUrl,
      benefit_action_type: payload.benefitActionType,
      benefit_action_link: payload.benefitActionLink,
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
      benefit_visibility: payload.benefitVisibility,
      managed_campus_slugs: managedCampusSlugs,
      branch_scope_type: branchPayload.branchScopeType,
      branch_scope_note: branchPayload.branchScopeNote,
    });

    if (error?.code === "23505") {
      const { data: existingPartner, error: existingPartnerError } = await supabase
        .from("partners")
        .select("id")
        .eq("id", partnerId)
        .maybeSingle();
      if (existingPartnerError || !existingPartner) {
        throw new Error(error.message);
      }
    } else if (error) {
      throw new Error(error.message);
    } else {
      createdPartner = true;
    }

    await persistAdminPartnerBranchLinks({
      supabase,
      partnerId,
      companyId: companyProvision.company?.id ?? null,
      brandProfileId: brandProfile.brandProfileId,
      branches: branchPayload.branches,
    });
  } catch (error) {
    if (createdPartner) {
      await supabase.from("partners").delete().eq("id", partnerId);
    }
    if (createdBrandProfileId) {
      await supabase
        .from("partner_brand_profiles")
        .delete()
        .eq("id", createdBrandProfileId);
    }
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await cleanupPartnerCompanyProvision(supabase, companyProvision);
    throw error;
  }

  return {
    partnerId,
    created: createdPartner,
    payload,
    managedCampusSlugs,
    companyProvision,
    media,
    supabase,
  };
}

async function finalizeCreatedPartner(record: CreatedPartnerRecord) {
  const {
    partnerId,
    created,
    payload,
    managedCampusSlugs,
    companyProvision,
    media,
    supabase,
  } = record;

  if (!created) {
    revalidatePartnerData();
    revalidateAdminAndPublicPaths(partnerId);
    return;
  }

  await logAdminAction("partner_create", {
    targetType: "partner",
    targetId: partnerId,
    properties: {
      name: payload.name,
      companyId: companyProvision?.company?.id ?? null,
      companyName: companyProvision?.company?.name ?? null,
      categoryId: payload.categoryId,
      location: payload.location,
      managedCampusSlugs,
      hasDetailDescription: Boolean(payload.detailDescription),
      campusSlugs: payload.campusSlugs,
      hasMapUrl: Boolean(payload.mapUrl),
      benefitActionType: payload.benefitActionType,
      hasBenefitActionLink: Boolean(payload.benefitActionLink),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      conditionCount: payload.conditions.length,
      visibility: payload.visibility,
      benefitVisibility: payload.benefitVisibility,
      benefitCount: payload.benefits.length,
      appliesTo: payload.appliesTo,
      hasThumbnail: Boolean(media.thumbnail),
      imageCount: media.images.length,
      tagCount: payload.tags.length,
    },
  });

  if (payload.visibility !== "private") {
    const { data: category } = await supabase
      .from("categories")
      .select("label")
      .eq("id", payload.categoryId)
      .maybeSingle();

    try {
      await sendCampusScopedNewPartnerNotification({
        partnerId,
        name: payload.name,
        location: payload.location,
        categoryLabel: category?.label ?? null,
        campusSlugs: payload.campusSlugs,
        benefitSummary: payload.benefits.join("\n"),
        conditions: payload.conditions.join("\n"),
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        mapUrl: payload.mapUrl,
      });
    } catch (pushError) {
      console.error("new partner push failed", pushError);
    }
  }

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(partnerId);
}

export async function createPartnerFormActionImpl(
  _prevState: PartnerCreateFormState,
  formData: FormData,
): Promise<PartnerCreateFormState> {
  const adminSession = await requireAdminPermission("brands", "create", {
    path: "/admin/partners/new",
  });
  try {
    const record = await createPartnerRecord(formData, adminSession.account);
    await finalizeCreatedPartner(record);
  } catch (error) {
    return {
      status: "error",
      errorCode:
        error instanceof Error ? error.message : "partner_form_invalid_request",
    };
  }

  redirect("/admin/partners?created=partner_created");
}
