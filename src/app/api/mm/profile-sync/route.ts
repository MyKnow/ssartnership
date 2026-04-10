import { NextResponse } from "next/server";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import {
  buildMemberSyncLogProperties,
  syncMemberById,
} from "@/lib/mm-member-sync";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, updated: false }, { status: 401 });
  }

  try {
    const syncResult = await syncMemberById(session.userId);
    if (syncResult?.updated) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId: session.userId,
        targetType: "member",
        targetId: session.userId,
        properties: buildMemberSyncLogProperties(syncResult, {
          source: "profile_view",
        }),
      });
    }

    return NextResponse.json({
      ok: true,
      updated: Boolean(syncResult?.updated),
    });
  } catch (error) {
    console.error("member profile sync failed", error);
    return NextResponse.json({ ok: false, updated: false }, { status: 500 });
  }
}
