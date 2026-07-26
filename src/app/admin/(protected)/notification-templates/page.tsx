import { Suspense } from "react";
import AdminNotificationTemplateManager from "@/components/admin/AdminNotificationTemplateManager";
import AdminOperationFlow from "@/components/admin/AdminOperationFlow";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import { AdminNotificationTemplatesSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import Button from "@/components/ui/Button";
import {
  sendNotificationTemplateTestAction,
  updateNotificationTemplateAction,
  resetNotificationTemplateAction,
} from "./actions";
import { requireNotificationTemplateAdmin } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { listNotificationTemplateSummaries } from "@/lib/notification-templates/repository.server";
import { getNotificationTemplateFeedback } from "@/lib/notification-templates/admin-feedback";

export const dynamic = "force-dynamic";

async function AdminNotificationTemplatesContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireNotificationTemplateAdmin>>;
  params: { status?: string; error?: string };
}) {
  const templates = await listNotificationTemplateSummaries();
  const feedback = getNotificationTemplateFeedback(params);

  return (
    <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="자동화"
          title="알림 템플릿 관리"
          description="이메일, Mattermost, 푸시, 인앱 알림의 기본 문구를 확인하고 채널별로 수정합니다. 민감한 실제 값은 저장하지 않고 {변수이름} 자리표시자만 관리합니다."
          actions={
            <Button href="/admin/push" variant="secondary">
              발송 관리
            </Button>
          }
        />
        <AdminOperationFlow
          steps={[
            {
              label: "템플릿",
              description: "채널별 기본 문구와 변수를 관리합니다.",
              state: "current",
            },
            {
              label: "작성",
              description: "필요한 대상을 정리해 메시지를 준비합니다.",
              href: "/admin/push?tab=send",
              state: "upcoming",
            },
            {
              label: "결과",
              description: "발송 이력과 실패 원인을 확인합니다.",
              href: "/admin/push?tab=logs",
              state: "upcoming",
            },
          ]}
        />
        <AdminNotificationTemplateManager
          templates={templates}
          updateAction={updateNotificationTemplateAction}
          resetAction={resetNotificationTemplateAction}
          testAction={sendNotificationTemplateTestAction}
          testRecipients={[]}
          defaultTestRecipientId={null}
          statusMessage={feedback?.tone === "info" ? feedback.message : null}
          errorMessage={feedback?.tone === "error" ? feedback.message : null}
          canUpdate={canAdmin(
            session.account.permissions,
            "notification_templates",
            "update",
          )}
          canDelete={canAdmin(
            session.account.permissions,
            "notification_templates",
            "delete",
          )}
        />
    </div>
  );
}

export default async function AdminNotificationTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; error?: string }>;
}) {
  const session = await requireNotificationTemplateAdmin("read", {
    path: "/admin/notification-templates",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="알림 템플릿" backHref="/admin" backLabel="관리 홈">
      <Suspense fallback={<AdminNotificationTemplatesSkeletonContent />}>
        <AdminNotificationTemplatesContent session={session} params={params} />
      </Suspense>
    </AdminShell>
  );
}
