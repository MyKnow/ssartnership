"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import { inferCampusSlugsFromLocation, normalizeCampusSlugs } from "@/lib/campuses";
import { sendCampusScopedNewPartnerNotification } from "@/lib/new-partner-notifications";
import {
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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
  service_mode: string;
  benefit_action_type: string;
  brand_name: string;
  category_id?: string | null;
  category_label: string;
  period_start?: string | null;
  period_end?: string | null;
  inquiry_link?: string | null;
  detail_description?: string | null;
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
  if (
    request.source !== "partner_portal" ||
    !request.company_id ||
    !request.category_id
  ) {
    return { partner: null, created: false };
  }

  const existingPartner = await findExistingConvertedPartner(supabase, request);
  if (existingPartner) {
    return { partner: existingPartner, created: false };
  }

  const normalizedCampusSlugs = normalizeCampusSlugs(campusSlugs);
  if (normalizedCampusSlugs.length === 0) {
    return { partner: null, created: false };
  }

  const partnerId = randomUUID();
  const benefitActionLink =
    request.benefit_action_link ??
    (request.benefit_action_type === "external_link" ? request.site_link ?? null : null);
  const { data, error } = await supabase
    .from("partners")
    .insert({
      id: partnerId,
      company_id: request.company_id,
      name: request.brand_name,
      category_id: request.category_id,
      location: request.location,
      detail_description: request.detail_description ?? null,
      campus_slugs: normalizedCampusSlugs,
      managed_campus_slugs: normalizedCampusSlugs,
      map_url: request.map_url ?? null,
      benefit_action_type: request.benefit_action_type,
      benefit_action_link: benefitActionLink,
      reservation_link: null,
      inquiry_link: request.inquiry_link ?? null,
      period_start: request.period_start ?? null,
      period_end: request.period_end ?? null,
      conditions: request.conditions ?? [],
      benefits: request.benefits ?? [],
      applies_to: ["staff", "student", "graduate"],
      thumbnail: request.thumbnail_url ?? null,
      images: request.image_urls ?? [],
      tags: request.tags ?? [],
      visibility: "public",
      benefit_visibility: "public",
    })
    .select("id,name,location,campus_slugs,visibility")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { partner: data as ConvertedPartnerRow, created: true };
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
      "id,status,source,company_id,service_mode,benefit_action_type,brand_name,category_id,category_label,period_start,period_end,inquiry_link,detail_description,benefits,conditions,tags,location,map_url,site_link,benefit_action_link,thumbnail_url,image_urls,company:partner_companies(managed_campus_slugs)",
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

      if (conversion.partner && conversion.created) {
        await logAdminAction("partner_create", {
          targetType: "partner",
          targetId: conversion.partner.id,
          properties: {
            source: "partner_registration_request",
            requestId: registrationRequest.id,
            requestSource: registrationRequest.source ?? null,
            name: conversion.partner.name,
            categoryId: registrationRequest.category_id ?? null,
            categoryLabel: registrationRequest.category_label,
            location: conversion.partner.location,
            campusSlugs: conversion.partner.campus_slugs ?? managedCampusSlugs,
            companyId: registrationRequest.company_id ?? null,
          },
        });

        if (conversion.partner.visibility !== "private") {
          await sendCampusScopedNewPartnerNotification({
            partnerId: conversion.partner.id,
            name: conversion.partner.name,
            location: conversion.partner.location,
            categoryLabel: registrationRequest.category_label,
            campusSlugs: conversion.partner.campus_slugs ?? managedCampusSlugs,
          });
        }

        revalidatePartnerData();
        revalidateAdminAndPublicPaths(conversion.partner.id);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "브랜드 등록 신청 승인 후처리에 실패했습니다.";
      console.error("[partner-registration] converted follow-up failed", message);
    }
  }

  revalidatePath("/admin/partner-registrations");
}
