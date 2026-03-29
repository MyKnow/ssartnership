import { NextRequest, NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/auth';
import { exportAdminLogsCsv, type LogGroup } from '@/lib/log-insights';

export const runtime = 'nodejs';

function parseGroups(rawValue: string | null): LogGroup[] {
  if (!rawValue) {
    return ['product', 'audit', 'security'];
  }

  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(
      (value): value is LogGroup =>
        value === 'product' || value === 'audit' || value === 'security',
    );

  return values.length ? values : ['product', 'audit', 'security'];
}

export async function GET(request: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { message: '관리자 인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const { filename, csv } = await exportAdminLogsCsv({
    preset: searchParams.get('preset'),
    start: searchParams.get('start'),
    end: searchParams.get('end'),
    groups: parseGroups(searchParams.get('groups')),
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
