import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminApiAccess } from '@/lib/admin-access';
import { getAdminLogsPageData } from '@/lib/log-insights';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const accessDenied = await ensureAdminApiAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  const searchParams = request.nextUrl.searchParams;
  const data = await getAdminLogsPageData({
    preset: searchParams.get('preset'),
    start: searchParams.get('start'),
    end: searchParams.get('end'),
  });

  return NextResponse.json(data);
}
