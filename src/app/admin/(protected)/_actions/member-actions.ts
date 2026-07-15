import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  buildMemberSyncLogProperties,
  syncMemberById,
  syncMembersBySelectableYears,
} from "@/lib/mm-member-sync";
import {
  buildDirectMemberCreateAuditProperties,
  DIRECT_MEMBER_CREATE_INITIAL_STATE,
  validateDirectMemberCreateInput,
  type DirectMemberCreateFormState,
} from "@/lib/member-direct-create";
import {
  DirectMemberProvisionError,
  provisionDirectMember,
} from "@/lib/member-direct-create-provision";
import {
  parseMemberYearValue,
  validateMemberYear,
} from "@/lib/validation";
import { isUuid } from "@/lib/uuid";
import {
  disableMattermostLoginsForGeneration,
  issueMemberEmailLoginTransition,
  isMattermostLoginDisabledReason,
  MemberEmailLoginTransitionError,
} from "@/lib/member-email-login-transition";
import { getMemberAuthCleanupKeys } from "@/lib/member-auth-security";
import { getMemberProfileSyncFailureCode } from "@/lib/member-profile-sync-errors";
import { resolveMemberProfileSyncStatus } from "@/lib/member-profile-sync-status";
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
    photoSkipped: 0,
    failures: 0,
    mattermostUnavailable: 0,
  };

  try {
    const result = await syncMembersBySelectableYears();
    const actorId = adminSession.adminId;
    summary = {
      checked: result.checked,
      updated: result.updated,
      skipped: result.skipped,
      photoSkipped: result.photoSkipped.length,
      failures: result.failures.length,
      mattermostUnavailable: result.mattermostUnavailable.length,
    };

    await Promise.allSettled([
      ...result.results.map((syncResult) =>
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
      ...result.photoSkipped
        .filter((syncResult) => !syncResult.updated)
        .map((syncResult) =>
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
      ...result.mattermostUnavailable.map((unavailableResult) =>
        logAdminAudit({
          ...context,
          action: "member_email_login_transition",
          actorId,
          targetType: "member",
          targetId: unavailableResult.member.id,
          properties: {
            source: "manual_backfill",
            reason: "provider_not_found",
            mmUserId: unavailableResult.member.mmUserId,
            generation: unavailableResult.member.generation,
          },
        }),
      ),
    ]);
    status =
      result.failures.length > 0 || result.photoSkipped.length > 0
        ? "partial"
        : "success";
  } catch (error) {
    console.error("member backfill failed", error);
    status = "error";
  }

  revalidateMemberPaths();
  if (status === "error") {
    redirect("/admin/members?backfill=error");
  }

  redirect(
    `/admin/members?backfill=${status}&checked=${summary.checked}&updated=${summary.updated}&skipped=${summary.skipped}&photoSkipped=${summary.photoSkipped}&failures=${summary.failures}&mattermostUnavailable=${summary.mattermostUnavailable}`,
  );
}

export async function syncMemberProfileAction(formData: FormData) {
  await requireAdminPermission("members", "update", {
    path: "/admin/members",
  });
  const memberId = String(formData.get("id") ?? "").trim();
  const detailPath = isUuid(memberId)
    ? `/admin/members/${memberId}`
    : "/admin/members";
  if (!isUuid(memberId)) {
    redirectAdminActionError(detailPath, "member_missing_id", {
      action: "member_sync",
      targetType: "member",
      properties: { source: "member_detail", reason: "invalid_member_id" },
    });
  }

  let result: Awaited<ReturnType<typeof syncMemberById>>;
  try {
    result = await syncMemberById(memberId);
  } catch (error) {
    const failureCode = getMemberProfileSyncFailureCode(error);
    redirectAdminActionError(detailPath, failureCode, {
      action: "member_sync",
      targetType: "member",
      targetId: memberId,
      properties: { source: "member_detail", reason: failureCode },
    });
  }

  if (!result) {
    redirectAdminActionError(detailPath, "member_sync_unavailable", {
      action: "member_sync",
      targetType: "member",
      targetId: memberId,
      properties: { source: "member_detail", reason: "member_not_syncable" },
    });
  }

  if (!("snapshot" in result)) {
    await logAdminAction("member_email_login_transition", {
      targetType: "member",
      targetId: result.member.id,
      properties: {
        source: "member_detail",
        reason: "provider_not_found",
        mmUserId: result.member.mmUserId,
        generation: result.member.generation,
      },
    });
    revalidateMemberPaths();
    revalidatePath(detailPath);
    redirect(`${detailPath}?memberSync=mattermostUnavailable`);
  }

  await logAdminAction("member_sync", {
    targetType: "member",
    targetId: result.member.id,
    properties: buildMemberSyncLogProperties(result, {
      source: "member_detail",
    }),
  });
  revalidateMemberPaths();
  revalidatePath(detailPath);
  redirect(
    `${detailPath}?memberSync=${resolveMemberProfileSyncStatus(result)}`,
  );
}

function memberEmailLoginTransitionErrorCode(error: unknown) {
  if (!(error instanceof MemberEmailLoginTransitionError)) {
    return "member_email_transition_failed";
  }
  return `member_email_transition_${error.code}`;
}

export async function disableGenerationMattermostLoginAction(formData: FormData) {
  await requireAdminPermission("members", "update", { path: "/admin/members" });
  const generationRaw = String(formData.get("generation") ?? "").trim();
  const confirmedGeneration = String(formData.get("confirmedGeneration") ?? "").trim();
  const generation = parseMemberYearValue(generationRaw);
  if (generation === null || generation < 1 || validateMemberYear(generationRaw)) {
    redirectAdminActionError("/admin/members", "member_invalid_year", {
      action: "member_mattermost_login_disable_generation",
      targetType: "generation",
      targetId: generationRaw || null,
      properties: { reason: "invalid_generation" },
    });
  }
  if (confirmedGeneration !== String(generation)) {
    redirectAdminActionError("/admin/members", "member_email_transition_generation_unconfirmed", {
      action: "member_mattermost_login_disable_generation",
      targetType: "generation",
      targetId: String(generation),
      properties: { reason: "generation_unconfirmed" },
    });
  }

  let disabledCount: number;
  try {
    disabledCount = await disableMattermostLoginsForGeneration(generation);
    await logAdminAction("member_mattermost_login_disable_generation", {
      targetType: "generation",
      targetId: String(generation),
      properties: { generation, disabledCount },
    });
  } catch {
    redirectAdminActionError("/admin/members", "member_email_transition_failed", {
      action: "member_mattermost_login_disable_generation",
      targetType: "generation",
      targetId: String(generation),
      properties: { generation },
    });
  }
  revalidateMemberPaths();
  redirect(
    `/admin/members?mmLoginTransition=generation&generation=${generation}&disabled=${disabledCount}`,
  );
}

export async function issueMemberEmailLoginTransitionAction(formData: FormData) {
  const adminSession = await requireAdminPermission("members", "update", {
    path: "/admin/members",
  });
  const memberId = String(formData.get("id") ?? "").trim();
  const email = formData.get("email");
  const reason = String(formData.get("reason") ?? "").trim();
  const identityVerified = formData.get("identityVerified") === "true";
  const detailPath = isUuid(memberId)
    ? `/admin/members/${memberId}`
    : "/admin/members";
  if (!isUuid(memberId)) {
    redirectAdminActionError(detailPath, "member_missing_id", {
      action: "member_email_login_transition",
      targetType: "member",
      properties: { reason: "invalid_member_id" },
    });
  }
  if (!isMattermostLoginDisabledReason(reason)) {
    redirectAdminActionError(detailPath, "member_email_transition_invalid_reason", {
      action: "member_email_login_transition",
      targetType: "member",
      targetId: memberId,
      properties: { reason: "invalid_transition_reason" },
    });
  }
  if (!identityVerified) {
    redirectAdminActionError(detailPath, "member_email_transition_identity_unconfirmed", {
      action: "member_email_login_transition",
      targetType: "member",
      targetId: memberId,
      properties: { reason: "identity_unconfirmed" },
    });
  }

  let result: { expiresAt: string };
  try {
    result = await issueMemberEmailLoginTransition({
      memberId,
      email,
      reason,
      initiatedByAdminId: adminSession.adminId,
    });
    await logAdminAction("member_email_login_transition", {
      targetType: "member",
      targetId: memberId,
      properties: {
        reason,
        expiresAt: result.expiresAt,
        identityVerified: true,
      },
    });
  } catch (error) {
    redirectAdminActionError(
      detailPath,
      memberEmailLoginTransitionErrorCode(error),
      {
        action: "member_email_login_transition",
        targetType: "member",
        targetId: memberId,
        properties: { reason },
      },
    );
  }
  revalidateMemberPaths();
  revalidatePath(detailPath);
  redirect(`${detailPath}?emailTransition=sent`);
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

export async function createDirectMemberAction(
  _prevState: DirectMemberCreateFormState,
  formData: FormData,
): Promise<DirectMemberCreateFormState> {
  const adminSession = await requireAdminPermission("members", "create", {
    path: "/admin/members",
  });
  const validation = validateDirectMemberCreateInput({
    loginId: formData.get("loginId"),
    displayName: formData.get("displayName"),
    generation: formData.get("generation"),
    campus: formData.get("campus"),
    temporaryPassword: formData.get("temporaryPassword"),
    temporaryPasswordConfirmation: formData.get("temporaryPasswordConfirmation"),
  });
  if (!validation.ok) {
    return {
      ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
      status: "error",
      message: "입력값을 확인해 주세요.",
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const member = await provisionDirectMember(validation.value);
    const context = await getServerActionLogContext("/admin/members");
    await logAdminAudit({
      ...context,
      action: "member_direct_create",
      actorId: adminSession.adminId,
      targetType: "member",
      targetId: member.id,
      properties: buildDirectMemberCreateAuditProperties(validation.value),
    });
    revalidateMemberPaths();
    revalidatePath("/admin/logs");
    return {
      ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
      status: "success",
      message: "직접 회원 계정을 생성했습니다. 임시 비밀번호를 안전한 경로로 전달해 주세요.",
      member,
    };
  } catch (error) {
    if (error instanceof DirectMemberProvisionError) {
      if (error.code === "duplicate_login_id") {
        return {
          ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
          status: "error",
          message: "입력값을 확인해 주세요.",
          fieldErrors: {
            loginId: "이미 사용 중인 직접 로그인 ID입니다.",
          },
        };
      }
      if (error.code === "mattermost_username_conflict") {
        return {
          ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
          status: "error",
          message: "입력값을 확인해 주세요.",
          fieldErrors: {
            loginId: "기존 Mattermost ID와 겹치는 직접 로그인 ID입니다.",
          },
        };
      }
      console.error("direct member create failed", { code: error.code });
    } else {
      console.error("direct member create failed");
    }
    return {
      ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
      status: "error",
      message: "계정을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
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
    .select("mattermost_account_id,manual_login_id")
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
    member.manual_login_id,
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
