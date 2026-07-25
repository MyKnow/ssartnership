import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import { appendAdminReviewQueueQuery } from "@/lib/admin-review-queue";
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
import { sanitizeReturnTo } from "@/lib/return-to";

const PARTNER_REQUESTS_PATH = "/admin/partner-requests";

function getReturnTo(formData: FormData) {
  return sanitizeReturnTo(
    String(formData.get("returnTo") ?? ""),
    PARTNER_REQUESTS_PATH,
  );
}

async function assertCanReviewPartnerChangeRequest(
  account: AdminScopeAccountLike,
  requestId: string,
  returnTo: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select("partner_id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request?.partner_id) {
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("managed_campus_slugs")
    .eq("id", request.partner_id)
    .maybeSingle();

  if (partnerError || !partner) {
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }

  try {
    assertAdminCanAccessManagedCampuses(
      account,
      (partner as { managed_campus_slugs?: string[] | null }).managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError(returnTo, "regional_admin_scope_denied");
  }
}

export async function approvePartnerChangeRequestAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const adminSession = await requireAdminPermission("brands", "update", {
    path: returnTo,
  });
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }
  await assertCanReviewPartnerChangeRequest(adminSession.account, requestId, returnTo);

  const request = await approvePartnerChangeRequestRecord({
    requestId,
    adminId: adminSession.adminId,
    auditContext: await createServerActionAuditContext(
      { actorType: "admin", actorId: adminSession.adminId },
      returnTo,
    ),
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "approved" }));
}

export async function rejectPartnerChangeRequestAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const adminSession = await requireAdminPermission("brands", "update", {
    path: returnTo,
  });
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }
  await assertCanReviewPartnerChangeRequest(adminSession.account, requestId, returnTo);

  const request = await rejectPartnerChangeRequestRecord({
    requestId,
    adminId: adminSession.adminId,
    auditContext: await createServerActionAuditContext(
      { actorType: "admin", actorId: adminSession.adminId },
      returnTo,
    ),
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "rejected" }));
}
