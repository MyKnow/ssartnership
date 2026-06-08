"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyAdminPermissionTemplate as applyAdminPermissionTemplateRecord,
  createAdminAccount as createAdminAccountRecord,
  issueAdminInitialSetupLink,
  updateAdminAccountStatus as updateAdminAccountStatusRecord,
  updateAdminPermissions as updateAdminPermissionsRecord,
} from "@/lib/admin-accounts";
import { requireAdminPermission } from "@/lib/admin-access";
import { parseAdminPermissionMatrixFormData } from "@/lib/admin-permissions";
import { logAdminAction } from "./shared-helpers";

function adminManagementPathWithStatus(status: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ status, ...extra });
  return `/admin/admins?${params.toString()}`;
}

export async function createAdminAccountAction(formData: FormData) {
  await requireAdminPermission("admin_management", "create", {
    path: "/admin/admins",
  });
  const loginId = String(formData.get("loginId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const templateKey = String(formData.get("templateKey") ?? "readonly").trim();
  let redirectPath = adminManagementPathWithStatus("created");

  try {
    const result = await createAdminAccountRecord({
      loginId,
      displayName,
      email,
      templateKey,
    });
    await logAdminAction("admin_account_create", {
      targetType: "admin_account",
      targetId: result.account.id,
      properties: {
        loginId: result.account.loginId,
        templateKey,
      },
    });
    revalidatePath("/admin/admins");
    redirectPath = adminManagementPathWithStatus("created", {
      setupUrl: result.setupUrl,
      setupLoginId: result.account.loginId,
    });
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "관리자 생성에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}

export async function issueAdminInitialSetupLinkAction(formData: FormData) {
  await requireAdminPermission("admin_management", "update", {
    path: "/admin/admins",
  });
  const adminId = String(formData.get("adminId") ?? "").trim();
  if (!adminId) {
    redirect(adminManagementPathWithStatus("error", { message: "계정을 찾을 수 없습니다." }));
  }
  let redirectPath = adminManagementPathWithStatus("setup-issued");

  try {
    const result = await issueAdminInitialSetupLink(adminId);
    await logAdminAction("admin_account_setup_link_issue", {
      targetType: "admin_account",
      targetId: result.account.id,
      properties: {
        loginId: result.account.loginId,
      },
    });
    revalidatePath("/admin/admins");
    redirectPath = adminManagementPathWithStatus("setup-issued", {
      setupUrl: result.setupUrl,
      setupLoginId: result.account.loginId,
    });
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "초기 설정 링크 발급에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}

export async function updateAdminAccountStatusAction(formData: FormData) {
  const actor = await requireAdminPermission("admin_management", "delete", {
    path: "/admin/admins",
  });
  const adminId = String(formData.get("adminId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";
  let redirectPath = adminManagementPathWithStatus(
    isActive ? "activated" : "deactivated",
  );

  try {
    await updateAdminAccountStatusRecord({
      actorAdminId: actor.adminId,
      targetAdminId: adminId,
      isActive,
    });
    await logAdminAction("admin_account_status_update", {
      targetType: "admin_account",
      targetId: adminId,
      properties: { isActive },
    });
    revalidatePath("/admin/admins");
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "계정 상태 변경에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}

export async function updateAdminPermissionsAction(formData: FormData) {
  const actor = await requireAdminPermission("admin_management", "update", {
    path: "/admin/admins",
  });
  const adminId = String(formData.get("adminId") ?? "").trim();
  const permissions = parseAdminPermissionMatrixFormData(formData);
  let redirectPath = adminManagementPathWithStatus("permissions-updated");

  try {
    await updateAdminPermissionsRecord({
      actorAdminId: actor.adminId,
      targetAdminId: adminId,
      permissions,
    });
    await logAdminAction("admin_account_permissions_update", {
      targetType: "admin_account",
      targetId: adminId,
    });
    revalidatePath("/admin/admins");
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "권한 저장에 실패했습니다.",
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
      targetType: "admin_account",
      targetId: adminId,
      properties: { templateKey },
    });
    revalidatePath("/admin/admins");
  } catch (error) {
    redirectPath = adminManagementPathWithStatus("error", {
      message: error instanceof Error ? error.message : "템플릿 적용에 실패했습니다.",
    });
  }
  redirect(redirectPath);
}
