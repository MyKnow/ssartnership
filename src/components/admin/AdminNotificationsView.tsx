import AdminNotificationInbox from "@/components/admin/AdminNotificationInbox";
import AdminOperationFlow from "@/components/admin/AdminOperationFlow";
import AdminOperationalNotificationSettingsPanel from "@/components/admin/AdminOperationalNotificationSettingsPanel";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Button from "@/components/ui/Button";
import StatsRow from "@/components/ui/StatsRow";
import type { AdminNotificationListResult } from "@/lib/admin-notification-inbox";
import type { AdminNotificationPreferenceState } from "@/lib/partner-notification-routing";

export default function AdminNotificationsView({
  notificationResult,
  preferences,
  deviceCount,
  pushConfigured,
  publicKey,
  canSend = true,
  loadError = false,
  showHeader = true,
}: {
  notificationResult: AdminNotificationListResult;
  preferences: AdminNotificationPreferenceState;
  deviceCount: number;
  pushConfigured: boolean;
  publicKey: string;
  canSend?: boolean;
  loadError?: boolean;
  showHeader?: boolean;
}) {
  return (
    <div className="grid gap-6">
      {showHeader ? (
        <AdminPageHeader
          eyebrow="작업함"
          title="내 알림"
          description="관리자 계정으로 수신한 변경 요청, 종료 임박, 보안 알림을 확인합니다."
        />
      ) : null}
      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="알림을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
          action={
            <Button href="/admin/notifications" variant="secondary">
              다시 확인
            </Button>
          }
        />
      ) : (
        <>
          <StatsRow
            items={[
              {
                label: "읽지 않음",
                value: `${notificationResult.unreadCount.toLocaleString("ko-KR")}건`,
                hint: "현재 관리자 수신함",
              },
              {
                label: "표시 중",
                value: `${notificationResult.items.length.toLocaleString("ko-KR")}건`,
                hint: notificationResult.hasMore
                  ? "더보기 가능"
                  : "현재 목록 전체",
              },
              {
                label: "푸시 기기",
                value: `${deviceCount.toLocaleString("ko-KR")}개`,
                hint: pushConfigured ? "웹푸시 구성됨" : "웹푸시 미구성",
              },
            ]}
            minItemWidth="13rem"
          />

          <AdminOperationFlow
            steps={[
              {
                label: "수신함",
                description: "운영 알림을 확인하고 목적지로 이동합니다.",
                state: "current",
              },
              ...(canSend
                ? [
                    {
                      label: "작성",
                      description: "필요한 안내를 대상별로 준비합니다.",
                      href: "/admin/push?tab=send",
                      state: "upcoming" as const,
                    },
                  ]
                : []),
              {
                label: "결과",
                description: "발송 결과와 실패 로그를 확인합니다.",
                href: "/admin/push?tab=logs",
                state: "upcoming" as const,
              },
            ]}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.75fr)] xl:items-start">
            <section className="grid gap-4">
              <AdminSectionHeading
                title="관리자 수신함"
                description="사용자 알림 페이지와 같은 방식으로 읽음, 삭제, 이동 작업을 처리합니다."
              />
              <AdminNotificationInbox initialState={notificationResult} />
            </section>
            <section className="grid gap-4 xl:sticky xl:top-24">
              <AdminSectionHeading
                title="수신 설정"
                description="관리자 인앱 알림과 웹푸시 수신 여부를 계정별로 관리합니다."
              />
              <AdminOperationalNotificationSettingsPanel
                pushConfigured={pushConfigured}
                publicKey={publicKey}
                preferences={preferences}
                deviceCount={deviceCount}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
