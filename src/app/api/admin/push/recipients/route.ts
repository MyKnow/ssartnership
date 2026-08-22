import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { conditionalJsonResponse } from "@/lib/conditional-json-response";
import {
  listAdminPushRecipientOptions,
  normalizeAdminPushRecipientSearch,
} from "@/lib/admin-push-recipient-search.server";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

function parseRecipientLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
    const denied = await timing.measure("auth", () =>
      ensureAdminApiPermission(request, "notifications", "read"),
    );
    if (denied) {
      return denied;
    }

    const result = await timing.measure("query", () =>
      listAdminPushRecipientOptions({
        query: normalizeAdminPushRecipientSearch(request.nextUrl.searchParams.get("query")),
        limit: parseRecipientLimit(request.nextUrl.searchParams.get("limit")),
      }),
    );
    if (result.failed) {
      return NextResponse.json(
        { message: "개인 발송 대상을 불러오지 못했습니다." },
        { status: 503 },
      );
    }

    return conditionalJsonResponse(request, { recipients: result.recipients });
  });
}
