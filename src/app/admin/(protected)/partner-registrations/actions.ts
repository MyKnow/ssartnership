"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import { inferCampusSlugsFromLocation } from "@/lib/campuses";
import {
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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
    .select("id,location,company:partner_companies(managed_campus_slugs)")
    .eq("id", id)
    .maybeSingle();

  if (requestError || !request) {
    return;
  }

  const company = Array.isArray((request as { company?: unknown }).company)
    ? ((request as { company?: Array<{ managed_campus_slugs?: string[] | null }> }).company?.[0] ?? null)
    : ((request as { company?: { managed_campus_slugs?: string[] | null } | null }).company ?? null);
  const managedCampusSlugs =
    company?.managed_campus_slugs ??
    inferCampusSlugsFromLocation((request as { location?: string | null }).location ?? "");
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

  await supabase
    .from("partner_registration_requests")
    .update(payload)
    .eq("id", id);

  revalidatePath("/admin/partner-registrations");
}
