import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { MattermostApiError, MattermostClient } from "@/lib/mattermost/client";
import { getMattermostSenderKeyring } from "@/lib/mattermost-senders/config";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import type { MattermostSenderSafeErrorCode } from "@/lib/mattermost-senders/types";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function toSafeHealthErrorCode(error: unknown): MattermostSenderSafeErrorCode {
  if (error instanceof MattermostApiError) {
    return error.code;
  }
  return "unavailable";
}

export async function GET(request: NextRequest) {
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let senders;
  try {
    senders = await mattermostSenderRepository.listActiveSendersForHealthCheck(
      getMattermostSenderKeyring(),
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Mattermost Sender 상태를 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  const client = new MattermostClient();
  const results: Array<{
    generation: number;
    status: "healthy" | "failed";
    errorCode?: MattermostSenderSafeErrorCode;
  }> = [];

  for (const sender of senders) {
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
      results.push({ generation: sender.generation, status: "healthy" });
    } catch (error) {
      const errorCode = toSafeHealthErrorCode(error);
      await mattermostSenderRepository.recordHealthFailure({
        senderId: sender.id,
        errorCode,
      }).catch(() => undefined);
      results.push({ generation: sender.generation, status: "failed", errorCode });
      console.error("[mattermost-sender-health] sender check failed", {
        generation: sender.generation,
        errorCode,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    healthy: results.filter((result) => result.status === "healthy").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
}
