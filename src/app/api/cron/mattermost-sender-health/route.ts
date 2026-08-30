import { NextRequest, NextResponse } from "next/server";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { MattermostApiError, MattermostClient } from "@/lib/mattermost/client";
import { getMattermostSenderKeyring } from "@/lib/mattermost-senders/config";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import type { MattermostSenderSafeErrorCode } from "@/lib/mattermost-senders/types";

export const runtime = "nodejs";

const SENDER_HEALTH_CHECK_CONCURRENCY = 4;

type SenderHealthCheckResult = {
  generation: number;
  status: "healthy" | "failed";
  errorCode?: MattermostSenderSafeErrorCode;
};

function toSafeHealthErrorCode(error: unknown): MattermostSenderSafeErrorCode {
  if (error instanceof MattermostApiError) {
    return error.code;
  }
  return "unavailable";
}

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  let senders;
  try {
    senders = await mattermostSenderRepository.listActiveSendersForHealthCheck(
      getMattermostSenderKeyring(),
    );
  } catch {
    return getCronErrorResponse("mattermost-sender-health");
  }

  const client = new MattermostClient();
  const results = new Array<SenderHealthCheckResult>(senders.length);

  await forEachWithConcurrency(
    senders,
    SENDER_HEALTH_CHECK_CONCURRENCY,
    async (sender, index) => {
      try {
        await client.withAuthenticatedSender(sender.credentials, async (session) => {
          let user;
          try {
            user = await session.getUserById(sender.senderMattermostUserId);
          } catch (error) {
            // The health target is the configured Sender itself. A 404 here is
            // therefore an access failure, unlike a missing signup target.
            if (error instanceof MattermostApiError && error.code === "not_found") {
              throw new MattermostApiError("forbidden", 404);
            }
            throw error;
          }
          if (user.id !== sender.senderMattermostUserId || user.deleteAt > 0) {
            throw new MattermostApiError("forbidden", 403);
          }
        });
        await mattermostSenderRepository.recordHealthSuccess(sender.id);
        results[index] = { generation: sender.generation, status: "healthy" };
      } catch (error) {
        const errorCode = toSafeHealthErrorCode(error);
        await mattermostSenderRepository.recordHealthFailure({
          senderId: sender.id,
          errorCode,
        }).catch(() => undefined);
        results[index] = { generation: sender.generation, status: "failed", errorCode };
        console.error("[mattermost-sender-health] sender check failed", {
          generation: sender.generation,
          errorCode,
        });
      }
    },
  );

  return NextResponse.json({
    ok: true,
    checked: results.length,
    healthy: results.filter((result) => result.status === "healthy").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
}
