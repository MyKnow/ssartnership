import { NextRequest, NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/auth';
import { getAdminLogsPageData } from '@/lib/log-insights';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { message: '관리자 인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const data = await getAdminLogsPageData({
    preset: searchParams.get('preset'),
    start: searchParams.get('start'),
    end: searchParams.get('end'),
  });

  return NextResponse.json(data);
}
