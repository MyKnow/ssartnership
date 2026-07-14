import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  buildMemberSyncLogProperties,
  syncMembersBySelectableYears,
} from "@/lib/mm-member-sync";
import {
  parseMemberYearValue,
  validateMemberYear,
} from "@/lib/validation";
import { getMemberAuthCleanupKeys } from "@/lib/member-auth-security";
import {
  getMmUserDirectoryEntriesByAccountIds,
  type MmUserDirectoryIdentity,
} from "@/lib/mm-directory/identities";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateMemberPaths,
} from "./shared-helpers";

export async function backfillMemberProfilesAction() {
  const adminSession = await requireAdminPermission("members", "update", {
    path: "/admin/members",
  });

  const context = await getServerActionLogContext("/admin/members");
  let status = "success";
  let summary = {
    checked: 0,
    updated: 0,
    skipped: 0,
    failures: 0,
  };

  try {
    const result = await syncMembersBySelectableYears();
    const actorId = adminSession.adminId;
    summary = {
      checked: result.checked,
      updated: result.updated,
      skipped: result.skipped,
      failures: result.failures.length,
    };

    await Promise.allSettled(
      result.results.map((syncResult) =>
        logAdminAudit({
          ...context,
          action: "member_sync",
          actorId,
          targetType: "member",
          targetId: syncResult.member.id,
          properties: buildMemberSyncLogProperties(syncResult, {
            source: "manual_backfill",
          }),
        }),
      ),
    );
    status = result.failures.length > 0 ? "partial" : "success";
  } catch (error) {
    console.error("member backfill failed", error);
    status = "error";
  }

  revalidateMemberPaths();
  if (status === "error") {
    redirect("/admin/members?backfill=error");
  }

  redirect(
    `/admin/members?backfill=${status}&checked=${summary.checked}&updated=${summary.updated}&skipped=${summary.skipped}&failures=${summary.failures}`,
  );
}

export async function updateMemberAction(formData: FormData) {
  await requireAdminPermission("members", "update", { path: "/admin/members" });
  const id = String(formData.get("id") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const generationRaw = String(formData.get("generation") || "").trim();
  const campus = String(formData.get("campus") || "").trim();
  const mustChangePassword =
    String(formData.get("mustChangePassword") || "false").trim() === "true";

  if (!id) {
    redirectAdminActionError("/admin/members", "member_missing_id", {
      action: "member_update",
      targetType: "member",
      properties: { reason: "missing_id" },
    });
  }

  const generationError = validateMemberYear(generationRaw);
  const generation = parseMemberYearValue(generationRaw);
  if (generationError || generation === null) {
    redirectAdminActionError("/admin/members", "member_invalid_year", {
      action: "member_update",
      targetType: "member",
      targetId: id,
      properties: { generationRaw },
    });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({
      display_name: displayName || null,
      generation,
      campus: campus || null,
      must_change_password: mustChangePassword,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectAdminActionError("/admin/members", "member_invalid_request", {
      action: "member_update",
      targetType: "member",
      targetId: id,
      properties: { errorCode: error.code },
    });
  }

  await logAdminAction("member_update", {
    targetType: "member",
    targetId: id,
    properties: {
      displayName,
      generation,
      campus,
      mustChangePassword,
    },
  });
  revalidateMemberPaths();
  redirect("/admin/members");
}

export async function deleteMemberAction(formData: FormData) {
  await requireAdminPermission("members", "delete", { path: "/admin/members" });
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectAdminActionError("/admin/members", "member_missing_id", {
      action: "member_delete",
      targetType: "member",
      properties: { reason: "missing_id" },
    });
  }

  const supabase = getSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("mattermost_account_id")
    .eq("id", id)
    .maybeSingle();

  if (memberError) {
    redirectAdminActionError("/admin/members", "member_invalid_request", {
      action: "member_delete",
      targetType: "member",
      targetId: id,
      properties: { errorCode: memberError.code },
    });
  }
  if (!member) {
    redirectAdminActionError("/admin/members", "member_missing_id", {
      action: "member_delete",
      targetType: "member",
      targetId: id,
      properties: { reason: "member_not_found" },
    });
  }

  let directoryEntry: MmUserDirectoryIdentity | null = null;
  try {
    const directoryByAccountId = await getMmUserDirectoryEntriesByAccountIds(
      member.mattermost_account_id ? [member.mattermost_account_id] : [],
    );
    directoryEntry = member.mattermost_account_id
      ? directoryByAccountId.get(member.mattermost_account_id) ?? null
      : null;
  } catch {
    redirectAdminActionError("/admin/members", "member_invalid_request", {
      action: "member_delete",
      targetType: "member",
      targetId: id,
      properties: { reason: "mattermost_directory_lookup_failed" },
    });
  }

  const cleanupIdentifiers = [
    directoryEntry?.mm_user_id,
    directoryEntry?.mm_username,
  ].filter((identifier): identifier is string => Boolean(identifier));
  for (const identifier of new Set(cleanupIdentifiers)) {
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", identifier);
  }

  const memberAuthCleanupKeys = getMemberAuthCleanupKeys([
    ...cleanupIdentifiers,
    id,
  ]);
  if (memberAuthCleanupKeys.length > 0) {
    await supabase
      .from("member_auth_attempts")
      .delete()
      .in("identifier", memberAuthCleanupKeys);
  }

  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) {
    redirectAdminActionError("/admin/members", "member_invalid_request", {
      action: "member_delete",
      targetType: "member",
      targetId: id,
      properties: { errorCode: error.code },
    });
  }

  await logAdminAction("member_delete", {
    targetType: "member",
    targetId: id,
    properties: {
      mmUserId: directoryEntry?.mm_user_id ?? null,
      mmUsername: directoryEntry?.mm_username ?? null,
    },
  });
  revalidateMemberPaths();
}
