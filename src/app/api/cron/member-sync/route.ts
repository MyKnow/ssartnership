import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import {
  buildMemberSyncLogProperties,
  syncMembersBySelectableYears,
} from "@/lib/mm-member-sync";
import { syncMmUserDirectoryBySelectableYears } from "@/lib/mm-directory";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const context = getRequestLogContext(request);
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const actorId = process.env.ADMIN_ID ?? "admin";
    const directoryResult = await syncMmUserDirectoryBySelectableYears();
    await logAdminAudit({
      ...context,
      action: "member_directory_sync",
      actorId,
      targetType: "directory",
      targetId: null,
      properties: {
        checked: directoryResult.checked,
        uniqueUsers: directoryResult.uniqueUsers,
        upserted: directoryResult.upserted,
        deleted: directoryResult.deleted,
        failures: directoryResult.failures.length,
      },
    });

    const result = await syncMembersBySelectableYears();

    for (const syncResult of result.results) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId,
        targetType: "member",
        targetId: syncResult.member.id,
        properties: buildMemberSyncLogProperties(syncResult, {
          source: "cron_backfill",
        }),
      });
    }

    return NextResponse.json({
      ok: true,
      directory: {
        checked: directoryResult.checked,
        uniqueUsers: directoryResult.uniqueUsers,
        upserted: directoryResult.upserted,
        deleted: directoryResult.deleted,
        failures: directoryResult.failures.length,
      },
      summary: {
        checked: result.checked,
        updated: result.updated,
        skipped: result.skipped,
        failures: result.failures.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
