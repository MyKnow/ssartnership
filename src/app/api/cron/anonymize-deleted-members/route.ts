import { NextRequest, NextResponse } from "next/server";
import { logAdminAudit, getRequestLogContext } from "@/lib/activity-logs";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import {
  anonymizeDeletedMember,
  listMembersEligibleForAnonymization,
} from "@/lib/member-lifecycle";
import { forEachWithConcurrency } from "@/lib/async-concurrency";

export const runtime = "nodejs";
const MEMBER_ANONYMIZATION_CONCURRENCY = 4;

export async function GET(request: NextRequest) {
  const context = getRequestLogContext(request);
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  try {
    const members = await listMembersEligibleForAnonymization();
    let anonymized = 0;
    let failed = 0;

    await forEachWithConcurrency(
      members,
      MEMBER_ANONYMIZATION_CONCURRENCY,
      async (member) => {
        try {
          if (await anonymizeDeletedMember(member.id)) {
            anonymized += 1;
          }
        } catch {
          failed += 1;
        }
      },
    );

    await logAdminAudit({
      ...context,
      action: "member_delete",
      actorId: "system",
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
    return getCronErrorResponse("anonymize-deleted-members");
  }
}
