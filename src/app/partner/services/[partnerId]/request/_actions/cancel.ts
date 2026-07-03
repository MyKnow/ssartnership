"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { PartnerChangeRequestError } from "@/lib/partner-change-request-errors";
import { cancelPartnerChangeRequest } from "@/lib/partner-change-requests";
import { getPartnerSession } from "@/lib/partner-session";
import {
  getAuthorizedCompanyIdsForPartnerAction,
  getReturnUrl,
  revalidatePartnerServicePaths,
} from "./shared";

export async function cancelPartnerChangeRequestActionImpl(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const requestId = String(formData.get("requestId") || "").trim();
  const partnerId = String(formData.get("partnerId") || "").trim();
  const { companyId, companyIds } = getAuthorizedCompanyIdsForPartnerAction(
    session,
    formData,
  );
  if (!requestId || !partnerId) {
    redirect("/partner?error=invalid_request");
  }

  try {
    const cancelled = await cancelPartnerChangeRequest({
      requestId,
      accountId: session.accountId,
      companyIds,
    });
    await logAdminAudit({
      ...(await getServerActionLogContext(getReturnUrl(partnerId, companyId))),
      actorId: session.accountId,
      action: "partner_portal_change_request_cancel",
      targetType: "partner",
      targetId: partnerId,
      properties: {
        requestId: cancelled.id,
        partnerId,
        partnerName: cancelled.partnerName,
        companyId: cancelled.companyId,
        companyIds: session.companyIds,
        actorLoginId: session.loginId,
        actorDisplayName: session.displayName,
      },
    });
  } catch (error) {
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePath("/admin/partners");
  revalidatePartnerServicePaths(partnerId, companyId);
  redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&success=cancelled`);
}
