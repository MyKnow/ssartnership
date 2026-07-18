import AdminNotificationTemplateManager from "@/components/admin/AdminNotificationTemplateManager";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import Button from "@/components/ui/Button";
import {
  sendNotificationTemplateTestAction,
  updateNotificationTemplateAction,
  resetNotificationTemplateAction,
} from "./actions";
import { requireNotificationTemplateAdmin } from "@/lib/admin-access";
import { listNotificationTemplates } from "@/lib/notification-templates/repository.server";
import { listNotificationTemplateTestRecipients } from "@/lib/notification-templates/test-delivery.server";

export const dynamic = "force-dynamic";

const STATUS_MESSAGES: Record<string, string> = {
  updated: "알림 템플릿을 저장했습니다.",
  reset: "알림 템플릿을 기본값으로 복원했습니다.",
  "test-sent": "선택한 회원에게 템플릿 테스트 발송을 완료했습니다.",
};

export default async function AdminNotificationTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; error?: string }>;
}) {
  await requireNotificationTemplateAdmin("read", { path: "/admin/notification-templates" });
  const params = (await searchParams) ?? {};
  const [templates, testRecipients] = await Promise.all([
    listNotificationTemplates(),
    listNotificationTemplateTestRecipients(),
  ]);

  return (
    <AdminShell title="알림 템플릿" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="Notification Templates"
          title="알림 템플릿 관리"
          description="이메일, Mattermost, 푸시, 인앱 알림의 기본 문구를 확인하고 채널별로 수정합니다. 민감한 실제 값은 저장하지 않고 {변수이름} 자리표시자만 관리합니다."
          actions={<Button href="/admin/push" variant="secondary">발송 관리</Button>}
        />
        <AdminNotificationTemplateManager
          templates={templates}
          updateAction={updateNotificationTemplateAction}
          resetAction={resetNotificationTemplateAction}
          testAction={sendNotificationTemplateTestAction}
          testRecipients={testRecipients.recipients}
          defaultTestRecipientId={testRecipients.defaultId}
          statusMessage={params.status ? STATUS_MESSAGES[params.status] ?? null : null}
          errorMessage={params.error ?? null}
        />
      </div>
    </AdminShell>
  );
}
