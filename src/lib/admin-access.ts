import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { logAuthSecurity, getRequestLogContext, getServerActionLogContext } from "@/lib/activity-logs";
import { isAdminSession } from "@/lib/auth";

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
