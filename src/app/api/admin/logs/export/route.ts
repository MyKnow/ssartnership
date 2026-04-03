import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminApiAccess } from '@/lib/admin-access';
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
  const accessDenied = await ensureAdminApiAccess(request);
  if (accessDenied) {
    return accessDenied;
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
