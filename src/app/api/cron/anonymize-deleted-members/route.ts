import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { logAdminAudit, getRequestLogContext } from "@/lib/activity-logs";
import {
  anonymizeDeletedMember,
  listMembersEligibleForAnonymization,
} from "@/lib/member-lifecycle";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  const context = getRequestLogContext(request);
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const members = await listMembersEligibleForAnonymization();
    let anonymized = 0;
    let failed = 0;

    for (const member of members) {
      try {
        if (await anonymizeDeletedMember(member.id)) {
          anonymized += 1;
        }
      } catch {
        failed += 1;
      }
    }

    await logAdminAudit({
      ...context,
      action: "member_delete",
      actorId: adminAuthorized ? "admin" : "system",
      targetType: "member",
      targetId: null,
      properties: {
        phase: "anonymization_cleanup",
        candidates: members.length,
        anonymized,
        failed,
      },
    });

    return NextResponse.json({
      ok: true,
      candidates: members.length,
      anonymized,
      failed,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "탈퇴 회원 익명화를 완료하지 못했습니다." },
      { status: 500 },
    );
  }
}
