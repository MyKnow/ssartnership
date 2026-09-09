import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminApiPermission } from '@/lib/admin-access';
import { getAdminLogAccessPolicy, selectAllowedLogGroups } from '@/lib/admin-log-access';
import { getRequestLogContext, logAdminAudit } from '@/lib/activity-logs';
import { getAdminSession } from '@/lib/auth';
import { exportAdminLogsCsv, type LogGroup, type LogRangePreset } from '@/lib/log-insights';
import { MAX_STANDARD_JSON_BODY_BYTES } from '@/lib/request-body-limit';
import { isTrustedSameOriginRequest } from '@/lib/request-guards';
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from '@/lib/route-json-body';
import { withServerTiming } from '@/lib/server-timing';

export const runtime = 'nodejs';

const LOG_GROUPS: LogGroup[] = ['product', 'audit', 'security'];
const LOG_RANGE_PRESETS: LogRangePreset[] = ['1h', '12h', '24h', '7d', '30d', 'custom'];

type ExportRequestBody = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  groups?: unknown;
};

function isLogGroup(value: unknown): value is LogGroup {
  return typeof value === 'string' && LOG_GROUPS.includes(value as LogGroup);
}

function parseExportRequestBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const body = value as ExportRequestBody;
  if (
    (body.preset !== undefined && body.preset !== null && typeof body.preset !== 'string') ||
    (body.start !== undefined && body.start !== null && typeof body.start !== 'string') ||
    (body.end !== undefined && body.end !== null && typeof body.end !== 'string') ||
    !Array.isArray(body.groups) ||
    body.groups.length === 0 ||
    !body.groups.every(isLogGroup)
  ) {
    return null;
  }

  const preset = body.preset && LOG_RANGE_PRESETS.includes(body.preset as LogRangePreset)
    ? body.preset
    : 'custom';
  return {
    preset,
    start: body.start ?? null,
    end: body.end ?? null,
    groups: Array.from(new Set(body.groups)),
  };
}

export async function POST(request: NextRequest) {
  return withServerTiming(async (timing) => {
    if (!isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ['application/json'],
    })) {
      return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 403 });
    }

    const accessDenied = await timing.measure('auth', () =>
      ensureAdminApiPermission(request, 'logs', 'read'),
    );
    if (accessDenied) {
      return accessDenied;
    }

    const session = await timing.measure('session', () => getAdminSession());
    if (!session) {
      return NextResponse.json({ message: '관리자 인증이 필요합니다.' }, { status: 401 });
    }

    let requestBody: unknown;
    try {
      requestBody = await readRouteJsonBodyWithinLimit<unknown>(request, {
        maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
        invalidMessage: '내보내기 요청 형식이 올바르지 않습니다.',
      });
    } catch (error) {
      if (error instanceof RouteJsonBodyError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      throw error;
    }

    const body = parseExportRequestBody(requestBody);
    if (!body) {
      return NextResponse.json({ message: '내보내기 요청 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const access = getAdminLogAccessPolicy(session.account);
    const allowedGroups = selectAllowedLogGroups(body.groups, access.exportGroups);
    if (allowedGroups.length !== body.groups.length) {
      return NextResponse.json({ message: '요청한 로그 내보내기 권한이 없습니다.' }, { status: 403 });
    }

    try {
      const { filename, stream, data } = await timing.measure('query', () =>
        exportAdminLogsCsv({
          ...body,
          groups: allowedGroups,
          includePii: access.includePii,
        }),
      );
    const auditRecorded = await timing.measure('audit', () => logAdminAudit({
      ...getRequestLogContext(request),
      action: 'admin_log_export_requested',
      actorType: 'admin',
      actorId: session.adminId,
      targetType: 'admin_logs',
      properties: {
        outcome: 'initiated',
        groups: allowedGroups,
        rangePreset: body.preset,
        includePii: access.includePii,
        exportedRows: {
          product: data.productRows.length,
          audit: data.auditRows.length,
          security: data.securityRows.length,
        },
        truncated: data.truncated,
      },
    }));
    if (!auditRecorded) {
      return NextResponse.json(
        { message: '내보내기 감사 기록 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

      return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    } catch (error) {
      console.error('[admin-logs] export failed', error);
      return NextResponse.json(
        { message: 'CSV 파일을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 },
      );
    }
  });
}
