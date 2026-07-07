import AdminShell from "@/components/admin/AdminShell";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  applyAdminPermissionTemplate,
  grantMemberAdminPermission,
  updateAdminAccountStatus,
} from "@/app/admin/(protected)/actions";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  listAdminAccounts,
  listAdminPermissionTemplates,
} from "@/lib/admin-accounts";
import {
  ADMIN_PERMISSION_RESOURCES,
  getAdminPermissionResourceLabel,
} from "@/lib/admin-permissions";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";

export const dynamic = "force-dynamic";

function statusMessage(status?: string, message?: string) {
  if (status === "granted" || status === "created") {
    return "회원에게 관리자 권한을 부여했습니다.";
  }
  if (status === "activated") {
    return "관리자 권한을 활성화했습니다.";
  }
  if (status === "revoked" || status === "deactivated") {
    return "관리자 권한을 회수했습니다.";
  }
  if (status === "permissions-updated") {
    return "관리자 권한을 저장했습니다.";
  }
  if (status === "template-applied") {
    return "권한 템플릿을 적용했습니다.";
  }
  if (status === "error") {
    return message || "관리자 작업에 실패했습니다.";
  }
  return null;
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("admin_management", "read", {
    path: "/admin/admins",
  });

  const params = (await searchParams) ?? {};
  const status = typeof params.status === "string" ? params.status : undefined;
  const message =
    typeof params.message === "string" ? params.message : undefined;
  const [accounts, templates] = await Promise.all([
    listAdminAccounts(),
    Promise.resolve(listAdminPermissionTemplates()),
  ]);
  const feedback = statusMessage(status, message);

  return (
    <AdminShell title="어드민 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Admin Access"
          title="멤버 관리자 권한"
          description="기존 회원 계정에 권한 ID를 부여해 어드민 페이지 접근과 기능 수행 범위를 관리합니다."
        />

        {feedback ? (
          <FormMessage
            variant={status === "error" ? "error" : "info"}
          >
            {feedback}
          </FormMessage>
        ) : null}

        <Card tone="elevated" className="grid gap-4">
          <SectionHeading
            title="멤버에게 관리자 권한 부여"
            description="회원가입된 Mattermost username을 입력하고 권한 ID를 선택합니다. 별도 관리자 계정이나 초기설정 링크는 만들지 않습니다."
          />
          <form action={grantMemberAdminPermission} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              회원 username
              <Input name="memberUsername" required placeholder="myknow" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              권한 ID
              <select
                name="templateKey"
                className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm text-foreground"
                defaultValue="readonly"
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="grid gap-2 md:col-span-3">
              <legend className="text-sm font-medium text-foreground">
                관리 캠퍼스
              </legend>
              <div className="flex flex-wrap gap-2">
                {CAMPUS_DIRECTORY.map((campus) => (
                  <label
                    key={campus.slug}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      name="managedCampusSlugs"
                      value={campus.slug}
                      className="h-4 w-4 accent-primary"
                    />
                    {campus.label}
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                지역 제휴 관리자 권한에만 적용됩니다. 전국 노출 제휴라도 운영 책임 지역은 여기서 별도로 관리합니다.
              </p>
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
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                      {account.displayName}
                    </h2>
                    <Badge variant="success">활성</Badge>
                    <Badge variant={account.permissionId === "super_admin" ? "danger" : "neutral"}>
                      {account.permissionId}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    @{account.loginId}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={updateAdminAccountStatus}>
                    <input type="hidden" name="adminId" value={account.id} />
                    <input type="hidden" name="isActive" value="false" />
                    <SubmitButton
                      variant="secondary"
                      pendingText="저장 중"
                      disabled={account.permissionId === "super_admin"}
                    >
                      권한 회수
                    </SubmitButton>
                  </form>
                </div>
              </div>

              <form action={applyAdminPermissionTemplate} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="adminId" value={account.id} />
                <label className="grid min-w-52 gap-2 text-sm font-medium text-foreground">
                  권한 ID 적용
                  <select
                    name="templateKey"
                    className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm text-foreground"
                    defaultValue={account.permissionId}
                  >
                    {templates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="grid min-w-full gap-2">
                  <legend className="text-sm font-medium text-foreground">
                    관리 캠퍼스
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {CAMPUS_DIRECTORY.map((campus) => (
                      <label
                        key={campus.slug}
                        className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
                      >
                        <input
                          type="checkbox"
                          name="managedCampusSlugs"
                          value={campus.slug}
                          defaultChecked={account.managedCampusSlugs.includes(campus.slug)}
                          className="h-4 w-4 accent-primary"
                        />
                        {campus.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SubmitButton variant="secondary" pendingText="적용 중">
                  적용
                </SubmitButton>
              </form>

              <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-4">
                <p className="text-sm font-semibold text-foreground">허용 리소스</p>
                <div className="flex flex-wrap gap-2">
                  {ADMIN_PERMISSION_RESOURCES.filter((resource) =>
                    Object.values(account.permissions[resource]).some(Boolean),
                  ).map((resource) => (
                    <Badge key={resource} variant="neutral">
                      {getAdminPermissionResourceLabel(resource)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-4">
                <p className="text-sm font-semibold text-foreground">관리 캠퍼스</p>
                <div className="flex flex-wrap gap-2">
                  {account.managedCampusSlugs.length > 0 ? (
                    account.managedCampusSlugs.map((slug) => {
                      const campus = CAMPUS_DIRECTORY.find((item) => item.slug === slug);
                      return (
                        <Badge key={slug} variant="neutral">
                          {campus?.label ?? slug}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      지역 제한 없음
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
