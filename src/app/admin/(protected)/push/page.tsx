import AdminPushManager from "@/components/admin/AdminPushManager";
import AdminShell from "@/components/admin/AdminShell";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatsRow from "@/components/ui/StatsRow";
import { isMattermostNotificationConfigured } from "@/lib/admin-notification-ops";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { isPushConfigured } from "@/lib/push";
import { getAdminPushReadModel } from "@/lib/admin-push-read-model.server";

export const dynamic = "force-dynamic";

export default async function AdminPushPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminPermission("notifications", "read", {
    path: "/admin/push",
  });
  const params = (await searchParams) ?? {};
  const initialTab =
    params.tab === "send" || params.tab === "logs" || params.tab === "center"
      ? params.tab
      : "center";
  const canSend = canAdmin(
    session.account.permissions,
    "notifications",
    "create",
  );
  const canDeleteLogs = canAdmin(
    session.account.permissions,
    "notifications",
    "delete",
  );

  const readModel = await getAdminPushReadModel({
    includeAudience: initialTab === "send" && canSend,
  });
  const pushConfigured = isPushConfigured();
  const mattermostConfigured = isMattermostNotificationConfigured();
  const recentLogCount = readModel.recentLogs.length;
  const automaticSummaryCount = readModel.automaticSummaries.length;

  return (
    <AdminShell title="발송 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="발송"
          title="발송 관리"
          description="메시지 작성, 발송 결과, 자동 발송 상태를 한 작업 영역에서 관리합니다."
        />
        {readModel.loadError ? (
          <AdminStatePanel
            kind="error"
            title="일부 발송 운영 정보를 불러오지 못했습니다."
            description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
            action={
              <Button
                href={`/admin/push${initialTab === "center" ? "" : `?tab=${initialTab}`}`}
                variant="secondary"
              >
                다시 확인
              </Button>
            }
          />
        ) : null}
        <StatsRow
          items={[
            {
              label: "회원 대상",
              value: `${readModel.memberCount.toLocaleString()}명`,
              hint: "개인·기수·캠퍼스 기준",
            },
            {
              label: "제휴처 대상",
              value: `${readModel.partnerCount.toLocaleString()}개`,
              hint: "신규 제휴/종료 임박 연결",
            },
            {
              label: "최근 로그",
              value: `${recentLogCount.toLocaleString()}건`,
              hint: "최근 30일 운영 로그",
            },
            {
              label: "자동 규칙",
              value: `${automaticSummaryCount.toLocaleString()}개`,
              hint: "예약/자동 발송 요약",
            },
          ]}
          minItemWidth="13rem"
        />
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <section className="grid gap-4">
            <AdminSectionHeading
              title="발송 워크스페이스"
              description="로그 확인과 즉시 발송을 같은 작업 영역에서 전환합니다."
            />
            <AdminPushManager
              pushConfigured={pushConfigured}
              mattermostConfigured={mattermostConfigured}
              partners={readModel.partners}
              members={readModel.members}
              availableYearOptions={readModel.availableYears}
              availableCampusOptions={readModel.availableCampuses}
              recentLogs={readModel.recentLogs}
              initialTab={initialTab}
              automaticSummaries={readModel.automaticSummaries}
              canSend={canSend}
              canDeleteLogs={canDeleteLogs}
            />
          </section>
          <div className="grid gap-6 2xl:sticky 2xl:top-24">
            <Card tone="elevated" className="grid gap-4">
              <AdminSectionHeading
                title="채널 상태"
                description="발송 전 먼저 확인해야 하는 운영 상태입니다."
              />
              <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>웹 푸시</span>
                  <span className="font-semibold text-foreground">
                    {pushConfigured ? "구성됨" : "미구성"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Mattermost</span>
                  <span className="font-semibold text-foreground">
                    {mattermostConfigured ? "구성됨" : "미구성"}
                  </span>
                </div>
              </div>
            </Card>
            <Card tone="elevated" className="grid gap-3">
              <AdminSectionHeading
                title="운영 메모"
                description="발송 화면을 넓게 쓰되, 보조 지침은 우측에 고정합니다."
              />
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p>대상 범위를 좁힌 뒤 리뷰 단계에서 수신 인원을 확인합니다.</p>
                <p>
                  실패/부분 실패 로그 추적도 같은 화면의 알림센터 탭에서 이어서
                  확인합니다.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
