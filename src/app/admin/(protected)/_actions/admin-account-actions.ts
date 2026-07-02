"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyAdminPermissionTemplate as applyAdminPermissionTemplateRecord,
  grantMemberAdminPermission,
  updateAdminAccountStatus as updateAdminAccountStatusRecord,
} from "@/lib/admin-accounts";
import { requireAdminPermission } from "@/lib/admin-access";
import { createAdminOperationalNotification } from "@/lib/operational-notifications";
import { logAdminAction } from "./shared-helpers";

function adminManagementPathWithStatus(status: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ status, ...extra });
  return `/admin/admins?${params.toString()}`;
}

async function notifyAdminSecurityAlert(input: {
  title: string;
  body: string;
  metadata: Record<string, unknown>;
}) {
  await createAdminOperationalNotification({
    type: "security_alert",
    title: input.title,
    body: input.body,
    targetUrl: "/admin/admins",
    metadata: input.metadata,
  }).catch((error) => {
    console.error("[admin-account-actions] security alert notification failed", error);
  });
}

export async function grantMemberAdminPermissionAction(formData: FormData) {
  await requireAdminPermission("admin_management", "create", {
    path: "/admin/admins",
  });
  const memberUsername = String(formData.get("memberUsername") ?? "").trim();
  const templateKey = String(formData.get("templateKey") ?? "readonly").trim();
  let redirectPath = adminManagementPathWithStatus("granted");

  try {
    const account = await grantMemberAdminPermission({
      memberUsername,
      templateKey,
    });
    await logAdminAction("admin_account_create", {
      targetType: "member_admin_permission",
      targetId: account.id,
      properties: {
        memberUsername: account.loginId,
        templateKey: account.permissionId,
      },
    });
    await notifyAdminSecurityAlert({
      title: "관리자 권한 부여",
      body: `${account.loginId} 계정에 ${account.permissionId} 권한이 부여되었습니다.`,
      metadata: {
        targetAdminId: account.id,
        targetLoginId: account.loginId,
        permissionId: account.permissionId,
      },
    });
    revalidatePath("/admin/admins");
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "관리자 권한 부여에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}

export async function createAdminAccountAction(formData: FormData) {
  return grantMemberAdminPermissionAction(formData);
}

export async function issueAdminInitialSetupLinkAction(formData?: FormData) {
  void formData;
  redirect(adminManagementPathWithStatus("error", {
    message: "member 기반 관리자 권한에서는 초기설정 링크를 사용하지 않습니다.",
  }));
}

export async function updateAdminAccountStatusAction(formData: FormData) {
  const actor = await requireAdminPermission("admin_management", "delete", {
    path: "/admin/admins",
  });
  const adminId = String(formData.get("adminId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";
  let redirectPath = adminManagementPathWithStatus(
    isActive ? "activated" : "revoked",
  );

  try {
    await updateAdminAccountStatusRecord({
      actorAdminId: actor.adminId,
      targetAdminId: adminId,
      isActive,
    });
    await logAdminAction("admin_account_status_update", {
      targetType: "member_admin_permission",
      targetId: adminId,
      properties: { isActive },
    });
    await notifyAdminSecurityAlert({
      title: isActive ? "관리자 권한 활성화" : "관리자 권한 회수",
      body: `관리자 계정 ${adminId}의 권한 상태가 변경되었습니다.`,
      metadata: {
        targetAdminId: adminId,
        isActive,
        actorAdminId: actor.adminId,
      },
    });
    revalidatePath("/admin/admins");
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "관리자 권한 상태 변경에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}

export async function applyAdminPermissionTemplateAction(formData: FormData) {
  const actor = await requireAdminPermission("admin_management", "update", {
    path: "/admin/admins",
  });
  const adminId = String(formData.get("adminId") ?? "").trim();
  const templateKey = String(formData.get("templateKey") ?? "").trim();
  let redirectPath = adminManagementPathWithStatus("template-applied");

  try {
    await applyAdminPermissionTemplateRecord({
      actorAdminId: actor.adminId,
      targetAdminId: adminId,
      templateKey,
    });
    await logAdminAction("admin_account_template_apply", {
      targetType: "member_admin_permission",
      targetId: adminId,
      properties: { templateKey },
    });
    await notifyAdminSecurityAlert({
      title: "관리자 권한 템플릿 변경",
      body: `관리자 계정 ${adminId}에 ${templateKey} 권한 템플릿이 적용되었습니다.`,
      metadata: {
        targetAdminId: adminId,
        templateKey,
        actorAdminId: actor.adminId,
      },
    });
    revalidatePath("/admin/admins");
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "권한 템플릿 적용에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}

export async function updateAdminPermissionsAction(formData: FormData) {
  return applyAdminPermissionTemplateAction(formData);
}
