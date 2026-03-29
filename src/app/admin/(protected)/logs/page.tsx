import AdminLogsManager from '@/components/admin/AdminLogsManager';
import AdminShell from '@/components/admin/AdminShell';
import { getAdminLogsPageData } from '@/lib/log-insights';

export const dynamic = 'force-dynamic';

export default async function AdminLogsPage() {
  const data = await getAdminLogsPageData({ preset: '24h' });

  return (
    <AdminShell title="로그 조회" backHref="/admin" backLabel="관리 홈">
      <AdminLogsManager initialData={data} />
    </AdminShell>
  );
}
