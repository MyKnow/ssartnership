import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminApiPermission } from '@/lib/admin-access';
import { getAdminLogAccessPolicy, isAllowedLogGroup } from '@/lib/admin-log-access';
import { getAdminSession } from '@/lib/auth';
import { getAdminLogsPageData } from '@/lib/log-insights';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const accessDenied = await ensureAdminApiPermission(request, 'logs', 'read');
  if (accessDenied) {
    return accessDenied;
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  const access = getAdminLogAccessPolicy(session.account);

  const searchParams = request.nextUrl.searchParams;
  if (!isAllowedLogGroup(searchParams.get('group'), access.readGroups)) {
    return NextResponse.json({ message: '요청한 로그 그룹 조회 권한이 없습니다.' }, { status: 403 });
  }
  const data = await getAdminLogsPageData({
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
  }, access);

  return NextResponse.json(data);
}
