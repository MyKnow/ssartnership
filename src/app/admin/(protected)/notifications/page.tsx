import { Suspense } from "react";
import AdminNotificationsView from "@/components/admin/AdminNotificationsView";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminNotificationsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminNotificationsReadModel } from "@/lib/admin-notifications.server";
import { getPushPublicKey, isPushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

async function AdminNotificationsContent({
  session,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
}) {
  const canSend = canAdmin(
    session.account.permissions,
    "notifications",
    "create",
  );
  const { notificationResult, preferences, deviceCount, loadError } =
    await getAdminNotificationsReadModel(session.adminId);

  return (
    <AdminNotificationsView
        notificationResult={notificationResult}
        preferences={preferences}
        deviceCount={deviceCount}
        pushConfigured={isPushConfigured()}
        publicKey={getPushPublicKey()}
        canSend={canSend}
        loadError={loadError}
        showHeader={false}
    />
  );
}

export default async function AdminNotificationsPage() {
  const session = await requireAdminPermission("notifications", "read", {
    path: "/admin/notifications",
  });

  return (
    <AdminShell title="내 알림" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="작업함"
          title="내 알림"
          description="관리자 계정으로 수신한 변경 요청, 종료 임박, 보안 알림을 확인합니다."
        />
        <Suspense fallback={<AdminNotificationsSkeletonContent showHeader={false} />}>
          <AdminNotificationsContent session={session} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
