import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { collectPartnerMediaUrls } from "@/app/admin/(protected)/_actions/partner-support";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { redirect } from "next/navigation";

function getSafeAdminPartnerPath(value: FormDataEntryValue | null, fallback: string) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (candidate.startsWith("/admin/partners")) {
    return candidate;
  }
  return fallback;
}

export async function deletePartnerAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "delete", {
    path: "/admin/partners",
  });
  const id = String(formData.get("id") || "").trim();
  const redirectPath = getSafeAdminPartnerPath(
    formData.get("deleteRedirectTo"),
    "/admin/partners",
  );
  if (!id) {
    redirectAdminActionError(redirectPath, "partner_form_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images,managed_campus_slugs")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError || !previousPartner) {
    redirectAdminActionError(redirectPath, "partner_form_invalid_request");
  }
  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      (previousPartner as { managed_campus_slugs?: string[] | null } | null)
        ?.managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError(redirectPath, "regional_admin_scope_denied");
  }

  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) {
    redirectAdminActionError(redirectPath, "partner_form_invalid_request");
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
  redirect(redirectPath);
}
