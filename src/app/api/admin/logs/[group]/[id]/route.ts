import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getAdminLogAccessPolicy } from "@/lib/admin-log-access";
import { getAdminSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

const LOG_GROUPS = ["product", "audit", "security"] as const;
type LogGroup = (typeof LOG_GROUPS)[number];

function isLogGroup(value: string): value is LogGroup {
  return LOG_GROUPS.includes(value as LogGroup);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group: string; id: string }> },
) {
  return withServerTiming(async (timing) => {
    const accessDenied = await timing.measure("auth", () =>
      ensureAdminApiPermission(request, "logs", "read"),
    );
    if (accessDenied) {
      return accessDenied;
    }

    const session = await timing.measure("session", () => getAdminSession());
    if (!session) {
      return NextResponse.json(
        { message: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { group: rawGroup, id } = await params;
    if (!isLogGroup(rawGroup) || !isUuid(id)) {
      return NextResponse.json(
        { message: "로그 상세 대상을 확인해 주세요." },
        { status: 400 },
      );
    }

    const access = getAdminLogAccessPolicy({
      permissionId: session.account.permissionId,
      permissions: session.account.permissions,
    });
    if (!access.readGroups.includes(rawGroup)) {
      return NextResponse.json(
        { message: "요청한 로그 그룹 조회 권한이 없습니다." },
        { status: 403 },
      );
    }

    const table =
      rawGroup === "product"
        ? "event_logs"
        : rawGroup === "audit"
          ? "admin_audit_logs"
          : "auth_security_logs";

    try {
      const { data, error } = await timing.measure("query", () =>
        getSupabaseAdminClient()
          .from(table)
          .select("id,properties")
          .eq("id", id)
          .maybeSingle(),
      );

      if (error) {
        return NextResponse.json(
          { message: "로그 상세를 불러오지 못했습니다." },
          { status: 503 },
        );
      }
      if (!data) {
        return NextResponse.json(
          { message: "로그 상세를 찾지 못했습니다." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          properties: access.includePii
            ? ((data as { properties?: Record<string, unknown> | null }).properties ?? null)
            : null,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return NextResponse.json(
        { message: "로그 상세를 불러오지 못했습니다." },
        { status: 503 },
      );
    }
  });
}
