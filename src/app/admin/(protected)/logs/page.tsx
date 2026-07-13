import AdminLogsManager from '@/components/admin/AdminLogsManager';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { requireAdminPermission } from '@/lib/admin-access';
import { getAdminLogsPageData } from '@/lib/log-insights';

export const dynamic = 'force-dynamic';

export default async function AdminLogsPage() {
  await requireAdminPermission('logs', 'read', { path: '/admin/logs' });
  const data = await getAdminLogsPageData({ preset: '24h' });

  return (
    <AdminShell title="로그 조회" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="Logs"
          title="운영 로그 조회"
          description="제품 이벤트, 관리자 감사, 인증 보안 로그를 공통 탐색 규칙으로 확인합니다."
        />
        <AdminLogsManager initialData={data} />
      </div>
    </AdminShell>
  );
}
