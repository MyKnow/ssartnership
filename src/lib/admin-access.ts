import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { logAuthSecurity, getRequestLogContext, getServerActionLogContext } from "@/lib/activity-logs";
import { getAdminSession } from "@/lib/auth";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";
import {
  type AdminPermissionAction,
  type AdminPermissionResource,
  canAdmin,
} from "@/lib/admin-permissions";
import { canManageMattermostSenders } from "@/lib/mattermost-senders/access";
import { getSignedUserSession } from "@/lib/user-auth";

export async function requireAdminPageAccess(path: string) {
  if (await getAdminSession()) {
    return;
  }

  const returnTo = sanitizeAdminReturnTo(path);
  const memberSession = await getSignedUserSession();
  if (memberSession?.userId) {
    redirect(`/admin/session?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const context = await getServerActionLogContext(path);
  void logAuthSecurity({
    ...context,
    eventName: "admin_access",
    status: "blocked",
    actorType: "guest",
    properties: {
      reason: "access_denied",
    },
  });

  redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
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
    const memberSession = await getSignedUserSession();
    const context = await getServerActionLogContext(path);
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: memberSession?.userId ? "member" : "guest",
      actorId: memberSession?.userId ?? null,
      properties: {
        reason: "access_denied",
        resource,
        action,
      },
    });
    const returnTo = sanitizeAdminReturnTo(path);
    if (memberSession?.userId) {
      redirect(`/admin/session?returnTo=${encodeURIComponent(returnTo)}`);
    }
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
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

/**
 * Sender credentials are more sensitive than ordinary admin resources. A
 * mutable permission bit alone must never delegate access away from the
 * super-admin template.
 */
export async function requireMattermostSenderAdmin(
  action: AdminPermissionAction,
  options?: {
    path?: string;
    redirectTo?: string;
  },
) {
  const session = await requireAdminPermission(
    "mattermost_senders",
    action,
    options,
  );
  if (canManageMattermostSenders(session.account, action)) {
    return session;
  }

  const context = await getServerActionLogContext(options?.path ?? "/admin/cycle");
  await logAuthSecurity({
    ...context,
    eventName: "admin_access",
    status: "blocked",
    actorType: "admin",
    actorId: session.adminId,
    identifier: session.loginId,
    properties: {
      reason: "super_admin_required",
      resource: "mattermost_senders",
      action,
    },
  });
  redirect(options?.redirectTo ?? "/admin?error=permission_denied");
}

export async function ensureAdminApiAccess(request: NextRequest) {
  if (await getAdminSession()) {
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
