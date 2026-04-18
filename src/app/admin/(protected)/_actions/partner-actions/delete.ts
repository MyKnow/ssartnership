import { requireAdmin } from "@/lib/auth";
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
  await requireAdmin();
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
    .select("thumbnail,images")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    redirectAdminActionError(redirectPath, "partner_form_invalid_request");
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
