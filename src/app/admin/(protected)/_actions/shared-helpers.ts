import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";

export async function logAdminAction(
  action: Parameters<typeof logAdminAudit>[0]["action"],
  input?: {
    targetType?: string | null;
    targetId?: string | null;
    properties?: Record<string, unknown> | null;
  },
) {
  const context = await getServerActionLogContext("/admin");
  await logAdminAudit({
    ...context,
    action,
    targetType: input?.targetType ?? null,
    targetId: input?.targetId ?? null,
    properties: input?.properties ?? {},
  });
}

export function revalidateAdminAndPublicPaths(partnerId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/partners/[id]", "page");
  if (partnerId) {
    revalidatePath(`/partners/${partnerId}`);
  }
}

export function revalidatePartnerPortalPaths(partnerId?: string) {
  revalidatePath("/partner");
  revalidatePath("/admin/partners");
  if (partnerId) {
    revalidatePath(`/partner/services/${partnerId}`);
    revalidatePath(`/partner/services/${partnerId}/request`);
  }
}

export function revalidateCategoryData() {
  revalidateTag("categories", "max");
}

export function revalidatePartnerData() {
  revalidateTag("partners", "max");
}

export function revalidatePartnerAccountData() {
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/partners");
}

export function revalidatePartnerCompanyData() {
  revalidateTag("partners", "max");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/partners");
  revalidatePath("/partner");
  revalidatePath("/partners/[id]", "page");
  revalidatePath("/partner/services/[partnerId]", "page");
  revalidatePath("/partner/services/[partnerId]/request", "page");
}

export function revalidateReviewPaths(partnerId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/reviews");
  revalidatePath("/partners/[id]", "page");
  revalidatePath("/partner/services/[partnerId]", "page");
  if (partnerId) {
    revalidatePath(`/partners/${partnerId}`);
    revalidatePath(`/partner/services/${partnerId}`);
  }
}

export function revalidateMemberPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/partners");
  revalidatePath("/admin/cycle");
  revalidatePath("/certification");
  revalidatePath("/auth/change-password");
}

export function revalidateCyclePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/cycle");
  revalidatePath("/admin/members");
  revalidatePath("/admin/push");
  revalidatePath("/auth/signup");
  revalidatePath("/certification");
}

export function redirectPartnerFormError(
  code: string,
  path = "/admin/partners",
): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

export function redirectAdminActionError(path: string, code: string): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}
