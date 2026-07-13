import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminFormAction } from "@/components/admin/admin-form-actions";
import type { AdminAccount } from "@/lib/admin-accounts";
import {
  ADMIN_PERMISSION_RESOURCES,
  getAdminPermissionResourceLabel,
  type AdminPermissionTemplate,
} from "@/lib/admin-permissions";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";

export default function AdminAccountsView({
  accounts,
  templates,
  feedback,
  feedbackIsError = false,
  grantAction,
  applyTemplateAction,
  updateStatusAction,
}: {
  accounts: AdminAccount[];
  templates: AdminPermissionTemplate[];
  feedback?: string | null;
  feedbackIsError?: boolean;
  grantAction: AdminFormAction;
  applyTemplateAction: AdminFormAction;
  updateStatusAction: AdminFormAction;
}) {
  return (
    <div className="grid gap-6">
      <AdminPageHeader
        eyebrow="Admin Access"
        title="회원 관리자 권한"
        description="기존 회원 계정에 권한 ID를 부여해 관리자 화면 접근과 기능 수행 범위를 관리합니다."
      />

      {feedback ? (
        <FormMessage variant={feedbackIsError ? "error" : "info"}>
          {feedback}
        </FormMessage>
      ) : null}

      <Card tone="elevated" className="grid gap-4">
        <AdminSectionHeading
          title="회원에게 관리자 권한 부여"
          description="가입된 Mattermost username과 권한 ID, 관리 캠퍼스를 지정합니다."
        />
        <form action={grantAction} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            회원 username
            <Input name="memberUsername" required placeholder="myknow" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            권한 ID
            <select name="templateKey" className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm text-foreground" defaultValue="readonly">
              {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
            </select>
          </label>
          <fieldset className="grid gap-2 md:col-span-3">
            <legend className="text-sm font-medium text-foreground">관리 캠퍼스</legend>
            <div className="flex flex-wrap gap-2">
              {CAMPUS_DIRECTORY.map((campus) => (
                <label key={campus.slug} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-2 text-sm text-foreground">
                  <input type="checkbox" name="managedCampusSlugs" value={campus.slug} className="h-4 w-4 accent-primary" />
                  {campus.label}
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">지역 제휴 관리자 권한에만 적용됩니다.</p>
          </fieldset>
          <SubmitButton pendingText="저장 중">권한 부여</SubmitButton>
        </form>
      </Card>

      <div className="grid gap-4">
        {accounts.map((account) => (
          <Card key={account.id} tone="elevated" className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{account.displayName}</h2>
                  <Badge variant="success">활성</Badge>
                  <Badge variant={account.permissionId === "super_admin" ? "danger" : "neutral"}>{account.permissionId}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">@{account.loginId}</p>
              </div>
              <form action={updateStatusAction}>
                <input type="hidden" name="adminId" value={account.id} />
                <input type="hidden" name="isActive" value="false" />
                <SubmitButton variant="secondary" pendingText="저장 중" disabled={account.permissionId === "super_admin"}>권한 회수</SubmitButton>
              </form>
            </div>

            <form action={applyTemplateAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="adminId" value={account.id} />
              <label className="grid min-w-52 gap-2 text-sm font-medium text-foreground">
                권한 ID 적용
                <select name="templateKey" className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm text-foreground" defaultValue={account.permissionId}>
                  {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
                </select>
              </label>
              <fieldset className="grid min-w-full gap-2">
                <legend className="text-sm font-medium text-foreground">관리 캠퍼스</legend>
                <div className="flex flex-wrap gap-2">
                  {CAMPUS_DIRECTORY.map((campus) => (
                    <label key={campus.slug} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-2 text-sm text-foreground">
                      <input type="checkbox" name="managedCampusSlugs" value={campus.slug} defaultChecked={account.managedCampusSlugs.includes(campus.slug)} className="h-4 w-4 accent-primary" />
                      {campus.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <SubmitButton variant="secondary" pendingText="적용 중">적용</SubmitButton>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-4">
                <p className="text-sm font-semibold text-foreground">허용 리소스</p>
                <div className="flex flex-wrap gap-2">
                  {ADMIN_PERMISSION_RESOURCES.filter((resource) => Object.values(account.permissions[resource]).some(Boolean)).map((resource) => (
                    <Badge key={resource} variant="neutral">{getAdminPermissionResourceLabel(resource)}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-4">
                <p className="text-sm font-semibold text-foreground">관리 캠퍼스</p>
                <div className="flex flex-wrap gap-2">
                  {account.managedCampusSlugs.length > 0 ? account.managedCampusSlugs.map((slug) => (
                    <Badge key={slug} variant="neutral">{CAMPUS_DIRECTORY.find((campus) => campus.slug === slug)?.label ?? slug}</Badge>
                  )) : <span className="text-sm text-muted-foreground">지역 제한 없음</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
