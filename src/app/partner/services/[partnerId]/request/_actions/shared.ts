import { revalidatePath, revalidateTag } from "next/cache";
import { getCompanyScopedPartnerServiceHref } from "@/lib/partner-portal-paths";
import type { PartnerSession } from "@/lib/partner-session";

export function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export function getReturnUrl(partnerId: string, companyId?: string | null) {
  return companyId
    ? getCompanyScopedPartnerServiceHref(companyId, partnerId)
    : `/partner/services/${encodeURIComponent(partnerId)}`;
}

export function getAuthorizedCompanyIdsForPartnerAction(
  session: PartnerSession,
  formData: FormData,
) {
  const companyId = String(formData.get("companyId") || "").trim();
  if (!companyId) {
    return { companyId: null, companyIds: session.companyIds };
  }
  if (!session.companyIds.includes(companyId)) {
    return { companyId, companyIds: [] };
  }
  return { companyId, companyIds: [companyId] };
}

export function revalidatePartnerServicePaths(partnerId: string, companyId?: string | null) {
  revalidateTag("partners", "max");
  revalidatePath("/partner");
  revalidatePath("/admin");
  revalidatePath("/admin/partners");
  revalidatePath("/partners/[id]", "page");
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}`);
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}/request`);
  if (companyId) {
    revalidatePath(getCompanyScopedPartnerServiceHref(companyId, partnerId));
  }
}
