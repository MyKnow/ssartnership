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

export async function deletePartnerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
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
}
