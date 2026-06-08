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
  createAdminAccount,
  issueAdminInitialSetupLink,
  updateAdminAccountStatus,
  updateAdminPermissions,
} from "@/app/admin/(protected)/actions";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  listAdminAccounts,
  listAdminPermissionTemplates,
} from "@/lib/admin-accounts";
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  getAdminPermissionActionLabel,
  getAdminPermissionResourceLabel,
} from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

function statusMessage(status?: string, message?: string) {
  if (status === "created") {
    return "관리자 계정을 생성했습니다. 초기 설정 링크를 전달해 주세요.";
  }
  if (status === "setup-issued") {
    return "초기 설정 링크를 다시 발급했습니다.";
  }
  if (status === "activated") {
    return "관리자 계정을 활성화했습니다.";
  }
  if (status === "deactivated") {
    return "관리자 계정을 비활성화했습니다.";
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
  const setupUrl = typeof params.setupUrl === "string" ? params.setupUrl : null;
  const setupLoginId =
    typeof params.setupLoginId === "string" ? params.setupLoginId : null;
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
          title="어드민 계정과 권한"
          description="관리자 계정을 만들고 리소스별 CRUD 권한을 템플릿과 개별 체크박스로 관리합니다."
        />

        {feedback ? (
          <FormMessage
            variant={status === "error" ? "error" : "info"}
          >
            {feedback}
          </FormMessage>
        ) : null}

        {setupUrl ? (
          <Card tone="elevated" className="grid gap-3">
            <SectionHeading
              title="초기 설정 링크"
              description={`${setupLoginId ?? "관리자"}에게 아래 링크를 전달하세요. 링크는 7일 뒤 만료됩니다.`}
            />
            <Input readOnly value={setupUrl} aria-label="초기 설정 링크" />
          </Card>
        ) : null}

        <Card tone="elevated" className="grid gap-4">
          <SectionHeading
            title="관리자 계정 생성"
            description="비밀번호를 직접 지정하지 않고 1회용 초기 설정 링크를 발급합니다."
          />
          <form action={createAdminAccount} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              로그인 ID
              <Input name="loginId" required placeholder="ssafy-admin" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              표시 이름
              <Input name="displayName" required placeholder="서울 운영 관리자" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              이메일
              <Input name="email" type="email" placeholder="admin@example.com" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              템플릿
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
            <div className="md:col-span-2">
              <SubmitButton pendingText="생성 중">계정 생성</SubmitButton>
            </div>
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
                    <Badge variant={account.isActive ? "success" : "neutral"}>
                      {account.isActive ? "활성" : "비활성"}
                    </Badge>
                    {account.initialSetupCompletedAt ? null : (
                      <Badge variant="warning">초기 설정 필요</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {account.loginId}
                    {account.email ? ` · ${account.email}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={issueAdminInitialSetupLink}>
                    <input type="hidden" name="adminId" value={account.id} />
                    <SubmitButton variant="secondary" pendingText="발급 중">
                      초기설정 링크
                    </SubmitButton>
                  </form>
                  <form action={updateAdminAccountStatus}>
                    <input type="hidden" name="adminId" value={account.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={account.isActive ? "false" : "true"}
                    />
                    <SubmitButton
                      variant="secondary"
                      pendingText="저장 중"
                    >
                      {account.isActive ? "비활성화" : "활성화"}
                    </SubmitButton>
                  </form>
                </div>
              </div>

              <form action={applyAdminPermissionTemplate} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="adminId" value={account.id} />
                <label className="grid min-w-52 gap-2 text-sm font-medium text-foreground">
                  템플릿 적용
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
                <SubmitButton variant="secondary" pendingText="적용 중">
                  적용
                </SubmitButton>
              </form>

              <form action={updateAdminPermissions} className="grid gap-4">
                <input type="hidden" name="adminId" value={account.id} />
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface-muted text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">리소스</th>
                        {ADMIN_PERMISSION_ACTIONS.map((action) => (
                          <th key={action} className="px-4 py-3 font-semibold">
                            {getAdminPermissionActionLabel(action)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ADMIN_PERMISSION_RESOURCES.map((resource) => (
                        <tr key={resource}>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                            {getAdminPermissionResourceLabel(resource)}
                          </th>
                          {ADMIN_PERMISSION_ACTIONS.map((action) => {
                            const disabled = resource === "logs" && action !== "read";
                            return (
                              <td key={action} className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  name={`permission:${resource}:${action}`}
                                  defaultChecked={account.permissions[resource][action]}
                                  disabled={disabled}
                                  className="h-4 w-4 rounded border-border text-primary"
                                  aria-label={`${getAdminPermissionResourceLabel(resource)} ${getAdminPermissionActionLabel(action)}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SubmitButton pendingText="저장 중">권한 저장</SubmitButton>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
