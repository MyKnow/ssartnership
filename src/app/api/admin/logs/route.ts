import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminApiPermission } from '@/lib/admin-access';
import { getAdminLogAccessPolicy, isAllowedLogGroup } from '@/lib/admin-log-access';
import { getAdminSession } from '@/lib/auth';
import { conditionalJsonResponse } from '@/lib/conditional-json-response';
import { getAdminLogsPageData } from '@/lib/log-insights';
import { withServerTiming } from '@/lib/server-timing';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
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

    const access = getAdminLogAccessPolicy(session.account);

    const searchParams = request.nextUrl.searchParams;
    if (!isAllowedLogGroup(searchParams.get('group'), access.readGroups)) {
      return NextResponse.json({ message: '요청한 로그 그룹 조회 권한이 없습니다.' }, { status: 403 });
    }
    try {
      const data = await timing.measure('query', () =>
        getAdminLogsPageData({
          preset: searchParams.get('preset'),
          start: searchParams.get('start'),
          end: searchParams.get('end'),
          page: searchParams.get('page'),
          pageSize: searchParams.get('pageSize'),
          search: searchParams.get('search'),
          group: searchParams.get('group'),
          name: searchParams.get('name'),
          actor: searchParams.get('actor'),
          status: searchParams.get('status'),
          sort: searchParams.get('sort'),
          cursor: searchParams.get('cursor'),
        }, access),
      );

      return conditionalJsonResponse(request, data);
    } catch (error) {
      console.error('[admin-logs] page query failed', error);
      return NextResponse.json(
        { message: '로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 },
      );
    }
  });
}
