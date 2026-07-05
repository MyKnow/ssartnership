import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "../../../../lib/activity-logs.ts";
import {
  buildAdminMutationAuditProperties,
  type AdminMutationAuditOutcome,
} from "@/lib/admin-mutation-audit";

export async function logAdminAction(
  action: Parameters<typeof logAdminAudit>[0]["action"],
  input?: {
    targetType?: string | null;
    targetId?: string | null;
    properties?: Record<string, unknown> | null;
    outcome?: AdminMutationAuditOutcome;
    reason?: string | null;
  },
) {
  const context = await getServerActionLogContext("/admin");
  await logAdminAudit({
    ...context,
    action,
    targetType: input?.targetType ?? null,
    targetId: input?.targetId ?? null,
    properties: buildAdminMutationAuditProperties({
      outcome: input?.outcome ?? "success",
      reason: input?.reason,
      properties: input?.properties ?? {},
    }),
  });
}

export function scheduleAdminActionFailureLog(
  action: Parameters<typeof logAdminAudit>[0]["action"],
  input?: {
    targetType?: string | null;
    targetId?: string | null;
    reason?: string | null;
    properties?: Record<string, unknown> | null;
  },
) {
  after(async () => {
    await logAdminAction(action, {
      targetType: input?.targetType,
      targetId: input?.targetId,
      outcome: "failure",
      reason: input?.reason,
      properties: input?.properties,
    });
  });
}

export function revalidateAdminAndPublicPaths(partnerId?: string) {
  revalidateTag("partners", "max");
  revalidatePath("/");
  revalidatePath("/admin");
  if (partnerId) {
    revalidatePath(`/admin/partners/${partnerId}`);
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
}

export function revalidatePartnerCompanyData() {
  revalidateTag("partners", "max");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/partners");
  revalidatePath("/partner");
}

export function revalidateReviewPaths(partnerId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/reviews");
  if (partnerId) {
    revalidatePath(`/admin/partners/${partnerId}`);
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

export function redirectAdminActionError(
  path: string,
  code: string,
  audit?: {
    action: Parameters<typeof logAdminAudit>[0]["action"];
    targetType?: string | null;
    targetId?: string | null;
    properties?: Record<string, unknown> | null;
  },
): never {
  if (audit) {
    scheduleAdminActionFailureLog(audit.action, {
      targetType: audit.targetType,
      targetId: audit.targetId,
      reason: code,
      properties: audit.properties,
    });
  }
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(code)}`);
}
