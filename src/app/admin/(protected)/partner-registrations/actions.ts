"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import {
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function updatePartnerRegistrationRequestStatus(formData: FormData) {
  await requireAdminPermission("brands", "update", {
    path: "/admin/partner-registrations",
  });

  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const adminNote = String(formData.get("adminNote") || "").trim();

  if (!id || !isPartnerRegistrationRequestStatus(status)) {
    return;
  }

  const session = await getAdminSession();
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
    payload.reviewed_by_admin_id = session?.adminId ?? null;
    payload.reviewed_at = new Date().toISOString();
  }

  await getSupabaseAdminClient()
    .from("partner_registration_requests")
    .update(payload)
    .eq("id", id);

  revalidatePath("/admin/partner-registrations");
}
