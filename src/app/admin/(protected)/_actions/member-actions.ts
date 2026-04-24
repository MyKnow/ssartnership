import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  buildMemberSyncLogProperties,
  syncMembersBySelectableYears,
} from "@/lib/mm-member-sync";
import {
  parseManualMemberAddInputList,
  provisionManualMembers,
  type ManualMemberAddFormState,
  type ManualMemberAddYear,
} from "@/lib/member-manual-add";
import {
  parseMemberYearValue,
  validateMemberYear,
} from "@/lib/validation";
import { getMemberAuthCleanupKeys } from "@/lib/member-auth-security";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateMemberPaths,
} from "./shared-helpers";
import { revalidatePath } from "next/cache";

export async function backfillMemberProfilesAction() {
  await requireAdmin();

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
    const actorId = process.env.ADMIN_ID ?? "admin";
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
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const campus = String(formData.get("campus") || "").trim();
  const mustChangePassword =
    String(formData.get("mustChangePassword") || "false").trim() === "true";

  if (!id) {
    redirectAdminActionError("/admin/members", "member_missing_id");
  }

  const yearError = validateMemberYear(yearRaw);
  const year = parseMemberYearValue(yearRaw);
  if (yearError || year === null) {
    redirectAdminActionError("/admin/members", "member_invalid_year");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({
      display_name: displayName || null,
      year,
      campus: campus || null,
      must_change_password: mustChangePassword,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectAdminActionError("/admin/members", "member_invalid_request");
  }

  await logAdminAction("member_update", {
    targetType: "member",
    targetId: id,
    properties: {
      displayName,
      year,
      campus,
      mustChangePassword,
    },
  });
  revalidateMemberPaths();
  redirect("/admin/members");
}

export async function manualAddMembersAction(
  _prevState: ManualMemberAddFormState,
  formData: FormData,
): Promise<ManualMemberAddFormState> {
  await requireAdmin();

  const requestedYearRaw = String(formData.get("requestedYear") || "").trim();
  const requestedYear = Number.parseInt(requestedYearRaw, 10) as ManualMemberAddYear;
  const mmIdsRaw = String(formData.get("mmIds") || "").trim();

  if (![0, 14, 15].includes(requestedYear)) {
    return {
      status: "error",
      message: "기수는 운영진, 14기, 15기 중 하나여야 합니다.",
      requestedYear: 15,
      total: 0,
      success: 0,
      failed: 0,
      items: [],
    };
  }

  const inputs = parseManualMemberAddInputList(mmIdsRaw);
  if (inputs.length === 0) {
    return {
      status: "error",
      message: "추가할 MM 아이디를 콤마로 구분해 입력해 주세요.",
      requestedYear,
      total: 0,
      success: 0,
      failed: 0,
      items: [],
    };
  }

  const context = await getServerActionLogContext("/admin/members");
  const actorId = process.env.ADMIN_ID ?? "admin";
  const result = await provisionManualMembers(requestedYear, inputs);

  const auditResults = await Promise.allSettled(
    result.items.map((item) =>
      logAdminAudit({
        ...context,
        action: "member_manual_add",
        actorId,
        targetType: "member",
        targetId: item.memberId ?? item.mmUserId ?? item.username,
        properties: {
          requestedYear: result.requestedYear,
          batchTotal: result.total,
          batchSuccess: result.success,
          batchFailed: result.failed,
          input: item.raw,
          normalizedUsername: item.username,
          status: item.status,
          action: item.action,
          reason: item.reason,
          resolvedYear: item.resolvedYear,
          staffSourceYear: item.staffSourceYear,
          memberId: item.memberId,
          mmUserId: item.mmUserId,
          mmUsername: item.mmUsername,
          displayName: item.displayName,
          campus: item.campus,
        },
      }),
    ),
  );
  for (const auditResult of auditResults) {
    if (auditResult.status === "rejected") {
      console.error("manual member add log failed", auditResult.reason);
    }
  }

  revalidateMemberPaths();
  revalidatePath("/admin/logs");

  return {
    status: result.failed > 0 ? (result.success > 0 ? "partial" : "error") : "success",
    message:
      result.success > 0
        ? `${result.success}명의 유저를 추가했습니다.`
        : "추가할 수 있는 유저가 없습니다.",
    ...result,
  };
}

export async function deleteMemberAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectAdminActionError("/admin/members", "member_missing_id");
  }

  const supabase = getSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("mm_user_id,mm_username")
    .eq("id", id)
    .maybeSingle();

  if (memberError) {
    redirectAdminActionError("/admin/members", "member_invalid_request");
  }
  if (!member?.mm_user_id && !member?.mm_username) {
    redirectAdminActionError("/admin/members", "member_missing_id");
  }

  if (member.mm_user_id) {
    await supabase.from("mm_verification_codes").delete().eq("mm_user_id", member.mm_user_id);
    await supabase.from("mm_verification_attempts").delete().eq("identifier", member.mm_user_id);
    await supabase.from("password_reset_attempts").delete().eq("identifier", member.mm_user_id);
    await supabase.from("password_reset_codes").delete().eq("mm_user_id", member.mm_user_id);
  }
  if (member.mm_username && member.mm_username !== member.mm_user_id) {
    await supabase.from("mm_verification_codes").delete().eq("mm_username", member.mm_username);
    await supabase.from("mm_verification_attempts").delete().eq("identifier", member.mm_username);
    await supabase.from("password_reset_attempts").delete().eq("identifier", member.mm_username);
    await supabase.from("password_reset_codes").delete().eq("mm_username", member.mm_username);
  }

  const memberAuthCleanupKeys = getMemberAuthCleanupKeys([
    member.mm_user_id,
    member.mm_username,
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
    redirectAdminActionError("/admin/members", "member_invalid_request");
  }

  await logAdminAction("member_delete", {
    targetType: "member",
    targetId: id,
    properties: {
      mmUserId: member.mm_user_id,
      mmUsername: member.mm_username,
    },
  });
  revalidateMemberPaths();
}
