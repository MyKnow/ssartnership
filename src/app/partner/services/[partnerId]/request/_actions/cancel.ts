"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PartnerChangeRequestError } from "@/lib/partner-change-request-errors";
import { cancelPartnerChangeRequest } from "@/lib/partner-change-requests";
import { getPartnerSession } from "@/lib/partner-session";
import { getReturnUrl } from "./shared";

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
  if (!requestId || !partnerId) {
    redirect("/partner?error=invalid_request");
  }

  try {
    await cancelPartnerChangeRequest({
      requestId,
      accountId: session.accountId,
      companyIds: session.companyIds,
    });
  } catch (error) {
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePath("/partner");
  revalidatePath("/admin/partners");
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}`);
  redirect(`${getReturnUrl(partnerId)}?mode=edit&success=cancelled`);
}
