import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { logAuthSecurity, getRequestLogContext, getServerActionLogContext } from "@/lib/activity-logs";
import { getAdminSession, isAdminSession } from "@/lib/auth";
import {
  type AdminPermissionAction,
  type AdminPermissionResource,
  canAdmin,
} from "@/lib/admin-permissions";

export async function requireAdminPageAccess(path: string) {
  if (await isAdminSession()) {
    return;
  }

  const context = await getServerActionLogContext(path);
  await logAuthSecurity({
    ...context,
    eventName: "admin_access",
    status: "blocked",
    actorType: "guest",
    properties: {
      reason: "access_denied",
    },
  });

  redirect("/admin/login?error=access_denied");
}

export async function requireAdminPermission(
  resource: AdminPermissionResource,
  action: AdminPermissionAction,
  options?: {
    path?: string;
    redirectTo?: string;
  },
) {
  const session = await getAdminSession();
  const path = options?.path ?? "/admin";
  if (!session) {
    const context = await getServerActionLogContext(path);
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: "guest",
      properties: {
        reason: "access_denied",
        resource,
        action,
      },
    });
    redirect("/admin/login?error=access_denied");
  }

  if (!canAdmin(session.account.permissions, resource, action)) {
    const context = await getServerActionLogContext(path);
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: "admin",
      actorId: session.adminId,
      identifier: session.loginId,
      properties: {
        reason: "permission_denied",
        resource,
        action,
      },
    });
    redirect(options?.redirectTo ?? "/admin?error=permission_denied");
  }

  return session;
}

export async function ensureAdminApiAccess(request: NextRequest) {
  if (await isAdminSession()) {
    return null;
  }

  await logAuthSecurity({
    ...getRequestLogContext(request),
    eventName: "admin_access",
    status: "blocked",
    actorType: "guest",
    properties: {
      reason: "access_denied",
    },
  });

  return NextResponse.json(
    { message: "관리자 인증이 필요합니다." },
    { status: 401 },
  );
}

export async function ensureAdminApiPermission(
  request: NextRequest,
  resource: AdminPermissionResource,
  action: AdminPermissionAction,
) {
  const session = await getAdminSession();
  if (!session) {
    await logAuthSecurity({
      ...getRequestLogContext(request),
      eventName: "admin_access",
      status: "blocked",
      actorType: "guest",
      properties: {
        reason: "access_denied",
        resource,
        action,
      },
    });

    return NextResponse.json(
      { message: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  if (!canAdmin(session.account.permissions, resource, action)) {
    await logAuthSecurity({
      ...getRequestLogContext(request),
      eventName: "admin_access",
      status: "blocked",
      actorType: "admin",
      actorId: session.adminId,
      identifier: session.loginId,
      properties: {
        reason: "permission_denied",
        resource,
        action,
      },
    });

    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  }

  return null;
}
