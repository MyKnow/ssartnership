import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  assertAdminCanAccessManagedCampuses,
  type AdminScopeAccountLike,
} from "@/lib/admin-scope";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  approvePartnerChangeRequest as approvePartnerChangeRequestRecord,
  rejectPartnerChangeRequest as rejectPartnerChangeRequestRecord,
} from "@/lib/partner-change-requests";
import {
  redirectAdminActionError,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
  revalidatePartnerPortalPaths,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { createServerActionAuditContext } from "@/lib/audit-context";

async function assertCanReviewPartnerChangeRequest(
  account: AdminScopeAccountLike,
  requestId: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select("partner_id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request?.partner_id) {
    redirectAdminActionError("/admin/partner-requests", "partner_form_invalid_request");
  }

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("managed_campus_slugs")
    .eq("id", request.partner_id)
    .maybeSingle();

  if (partnerError || !partner) {
    redirectAdminActionError("/admin/partner-requests", "partner_form_invalid_request");
  }

  try {
    assertAdminCanAccessManagedCampuses(
      account,
      (partner as { managed_campus_slugs?: string[] | null }).managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError("/admin/partner-requests", "regional_admin_scope_denied");
  }
}

export async function approvePartnerChangeRequestAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partner-requests",
  });
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError("/admin/partner-requests", "partner_form_invalid_request");
  }
  await assertCanReviewPartnerChangeRequest(adminSession.account, requestId);

  const request = await approvePartnerChangeRequestRecord({
    requestId,
    adminId: adminSession.adminId,
    auditContext: await createServerActionAuditContext(
      { actorType: "admin", actorId: adminSession.adminId },
      "/admin/partner-requests",
    ),
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect("/admin/partner-requests");
}

export async function rejectPartnerChangeRequestAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partner-requests",
  });
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError("/admin/partner-requests", "partner_form_invalid_request");
  }
  await assertCanReviewPartnerChangeRequest(adminSession.account, requestId);

  const request = await rejectPartnerChangeRequestRecord({
    requestId,
    adminId: adminSession.adminId,
    auditContext: await createServerActionAuditContext(
      { actorType: "admin", actorId: adminSession.adminId },
      "/admin/partner-requests",
    ),
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect("/admin/partner-requests");
}
