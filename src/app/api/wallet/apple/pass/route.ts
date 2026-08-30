import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { consumeProductEventQuota } from "@/lib/product-event-throttle";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { getSignedUserSession } from "@/lib/user-auth";
import {
  revokeAppleWalletPassRequestSchema,
  issueAppleWalletPassRequestSchema,
} from "@/lib/wallet/wallet-pass-request";
import {
  getAppleWalletPassForMemberDownload,
  getAppleWalletPassLastModified,
  issueAppleWalletMemberPass,
  revokeAppleWalletMemberPass,
  WalletPassServiceError,
} from "@/lib/wallet/wallet-pass-service";

export const runtime = "nodejs";

const PASS_FILE_NAME = "ssartnership-member-pass.pkpass";

function jsonMessage(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function consumeWalletPassQuota(
  request: NextRequest,
  userId: string,
  eventName: "wallet_pass_issue" | "wallet_pass_download" | "wallet_pass_revoke",
) {
  const context = getRequestLogContext(request);
  return {
    context,
    allowed: consumeProductEventQuota({
      eventName,
      ipAddress: context.ipAddress,
      actorKey: `member:${userId}`,
      scopeKey: "wallet-pass",
    }),
  };
}

function mapWalletPassServiceError(error: unknown) {
  if (!(error instanceof WalletPassServiceError)) {
    return jsonMessage("Apple Wallet 요청을 처리하지 못했습니다.", 503);
  }

  switch (error.code) {
    case "wallet_not_configured":
    case "wallet_pass_build_failed":
      return jsonMessage(error.message, 503);
    case "wallet_ineligible":
    case "wallet_pass_idempotency_conflict":
    case "wallet_pass_snapshot_outdated":
      return jsonMessage(error.message, 409);
    case "wallet_pass_not_found":
      return jsonMessage(error.message, 404);
    case "wallet_pass_revoked":
      return jsonMessage(error.message, 410);
    case "wallet_pass_snapshot_invalid":
      return jsonMessage(error.message, 500);
    default:
      return jsonMessage("Apple Wallet 요청을 처리하지 못했습니다.", 503);
  }
}

async function requireSignedUserId() {
  noStore();
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return { response: jsonMessage("로그인이 필요합니다.", 401) };
  }
  return { userId: session.userId };
}

async function parseJsonBody(request: NextRequest) {
  try {
    return await readRouteJsonBodyWithinLimit<unknown>(request, {
      maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
      invalidMessage: "요청 본문 형식을 확인해 주세요.",
      tooLargeMessage: "요청이 너무 큽니다.",
    });
  } catch (error) {
    if (error instanceof RouteJsonBodyError && error.code === "body_too_large") {
      throw error;
    }
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireSignedUserId();
  if ("response" in auth) {
    return auth.response;
  }
  const quota = consumeWalletPassQuota(
    request,
    auth.userId,
    "wallet_pass_download",
  );
  if (!quota.allowed) {
    return jsonMessage("요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  }

  try {
    const { pass, buffer } = await getAppleWalletPassForMemberDownload(
      auth.userId,
    );

    scheduleProductEventLog({
      ...quota.context,
      actorType: "member",
      actorId: auth.userId,
      eventName: "wallet_pass_download",
      targetType: "wallet_pass",
      properties: { platform: "apple" },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "content-length": String(buffer.byteLength),
        "content-disposition": `attachment; filename="${PASS_FILE_NAME}"`,
        "cache-control": "private, no-store",
        "last-modified": getAppleWalletPassLastModified(pass),
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return mapWalletPassServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  noStore();
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return jsonMessage("잘못된 요청입니다.", 403);
  }

  const auth = await requireSignedUserId();
  if ("response" in auth) {
    return auth.response;
  }
  const quota = consumeWalletPassQuota(
    request,
    auth.userId,
    "wallet_pass_issue",
  );
  if (!quota.allowed) {
    return jsonMessage("요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  }

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch (error) {
    if (error instanceof RouteJsonBodyError) {
      return jsonMessage(error.message, error.status);
    }
    return jsonMessage("Apple Wallet 발급 요청을 확인해 주세요.", 400);
  }
  const parsed = issueAppleWalletPassRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonMessage("Apple Wallet 발급 요청을 확인해 주세요.", 400);
  }

  try {
    const result = await issueAppleWalletMemberPass({
      memberId: auth.userId,
      consentVersion: parsed.data.consentVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    scheduleProductEventLog({
      ...quota.context,
      actorType: "member",
      actorId: auth.userId,
      eventName: "wallet_pass_issue",
      targetType: "wallet_pass",
      properties: {
        platform: "apple",
        isNewPass: result.isNewPass,
        isNewRevision: result.isNewRevision,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        downloadUrl: "/api/wallet/apple/pass",
      },
      { status: result.isNewPass ? 201 : 200 },
    );
  } catch (error) {
    return mapWalletPassServiceError(error);
  }
}

export async function DELETE(request: NextRequest) {
  noStore();
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return jsonMessage("잘못된 요청입니다.", 403);
  }

  const auth = await requireSignedUserId();
  if ("response" in auth) {
    return auth.response;
  }
  const quota = consumeWalletPassQuota(
    request,
    auth.userId,
    "wallet_pass_revoke",
  );
  if (!quota.allowed) {
    return jsonMessage("요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  }

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch (error) {
    if (error instanceof RouteJsonBodyError) {
      return jsonMessage(error.message, error.status);
    }
    return jsonMessage("Apple Wallet 폐기 요청을 확인해 주세요.", 400);
  }
  const parsed = revokeAppleWalletPassRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonMessage("Apple Wallet 폐기 요청을 확인해 주세요.", 400);
  }

  try {
    const result = await revokeAppleWalletMemberPass({
      memberId: auth.userId,
      idempotencyKey: parsed.data.idempotencyKey,
      reason: parsed.data.reason,
    });

    scheduleProductEventLog({
      ...quota.context,
      actorType: "member",
      actorId: auth.userId,
      eventName: "wallet_pass_revoke",
      targetType: "wallet_pass",
      properties: {
        platform: "apple",
        alreadyRevoked: result.alreadyRevoked,
      },
    });

    return NextResponse.json({
      ok: true,
      alreadyRevoked: result.alreadyRevoked,
    });
  } catch (error) {
    return mapWalletPassServiceError(error);
  }
}
