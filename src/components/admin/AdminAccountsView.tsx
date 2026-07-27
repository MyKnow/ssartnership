import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import AdminWorkspaceSummary from "@/components/admin/AdminWorkspaceSummary";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
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
  loadError = false,
  canGrant = false,
  canUpdate = false,
  canDelete = false,
  grantAction,
  applyTemplateAction,
  updateStatusAction,
}: {
  accounts: AdminAccount[];
  templates: AdminPermissionTemplate[];
  feedback?: string | null;
  feedbackIsError?: boolean;
  loadError?: boolean;
  canGrant?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  grantAction: AdminFormAction;
  applyTemplateAction: AdminFormAction;
  updateStatusAction: AdminFormAction;
}) {
  const activeAccounts = accounts.filter((account) => account.isActive);
  const inactiveAccounts = accounts.filter((account) => !account.isActive);
  const privilegedAccounts = accounts.filter(
    (account) =>
      account.isActive &&
      account.permissions.admin_management.update &&
      account.permissions.admin_management.delete,
  );

  return (
    <div className="grid gap-6">
      <AdminPageHeader
        eyebrow="설정"
        title="회원 관리자 권한"
        description="기존 회원 계정에 권한 템플릿을 부여해 관리자 화면 접근과 기능 수행 범위를 관리합니다."
      />

      {feedback ? (
        <FormMessage variant={feedbackIsError ? "error" : "info"}>
          {feedback}
        </FormMessage>
      ) : null}

      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="관리자 계정을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={
            <Button href="/admin/admins" variant="secondary">
              다시 확인
            </Button>
          }
        />
      ) : (
        <>
          <AdminWorkspaceSummary
            eyebrow="접근 관리"
            title="관리자 권한 현황"
            description="현재 상태를 먼저 확인한 뒤, 필요한 계정만 열어 권한과 관리 범위를 조정합니다."
            items={[
              {
                label: "전체 관리자",
                value: `${accounts.length}명`,
                detail: "관리자 권한 프로필이 있는 회원",
              },
              {
                label: "활성 관리자",
                value: `${activeAccounts.length}명`,
                detail: `비활성 ${inactiveAccounts.length}명`,
              },
              {
                label: "권한 관리 가능",
                value: `${privilegedAccounts.length}명`,
                detail: "관리자 권한 변경·회수가 가능한 계정",
              },
            ]}
          />

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start">
            <section className="grid min-w-0 gap-4 lg:order-1">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <AdminSectionHeading
                  title="관리자 목록"
                  description="상태와 권한 범위를 먼저 확인하고, 필요한 계정만 펼쳐 관리합니다."
                />
                <Badge variant="neutral">{accounts.length}명</Badge>
              </div>

              {accounts.length === 0 ? (
                <AdminStatePanel
                  kind="empty"
                  title="관리자 권한을 가진 회원이 없습니다."
                  description={
                    canGrant
                      ? "오른쪽에서 회원 username과 권한 템플릿을 지정해 첫 관리자를 추가해 주세요."
                      : "현재 계정에는 관리자 권한을 추가할 수 없습니다."
                  }
                />
              ) : null}

              {accounts.map((account) => {
                const permissionName =
                  templates.find(
                    (template) => template.key === account.permissionId,
                  )?.name ?? account.permissionId;
                const canRevoke =
                  account.permissionId !== "super_admin" && canDelete;
                const canActivate = !account.isActive && canDelete;

                return (
                  <Card
                    key={account.id}
                    tone="elevated"
                    padding="none"
                    className="overflow-hidden"
                  >
                    <details className="group">
                      <summary className="grid cursor-pointer list-none gap-4 px-5 py-4 transition hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="min-w-0 truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
                              {account.displayName}
                            </h2>
                            <Badge
                              variant={account.isActive ? "success" : "danger"}
                            >
                              {account.isActive ? "활성" : "비활성"}
                            </Badge>
                            <Badge
                              variant={
                                account.permissionId === "super_admin"
                                  ? "danger"
                                  : "neutral"
                              }
                            >
                              {permissionName}
                            </Badge>
                          </div>
                          <p className="mt-1 break-all text-sm text-muted-foreground">
                            @{account.loginId}
                          </p>
                        </div>
                        <div className="grid gap-1 text-left text-sm text-muted-foreground sm:justify-items-end">
                          <span>
                            {account.managedCampusSlugs.length > 0
                              ? `관리 캠퍼스 ${account.managedCampusSlugs.length}곳`
                              : "전체 캠퍼스"}
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            펼쳐서 관리
                          </span>
                        </div>
                      </summary>

                      <div className="grid gap-5 border-t border-border/70 p-5 sm:p-6">
                        {canUpdate || canDelete ? (
                          <Surface
                            level="inset"
                            className="grid gap-4 p-4 sm:p-5"
                          >
                            <AdminSectionHeading
                              title="운영 도구"
                              description={
                                account.permissionId === "super_admin"
                                  ? "최고 관리자 계정은 마지막 권한 보유자 보호를 위해 회수할 수 없습니다."
                                  : "권한 범위와 관리 캠퍼스를 변경하거나 권한을 회수합니다."
                              }
                            />
                            <div className="flex flex-wrap justify-end gap-2">
                              {canDelete ? (
                                <form action={updateStatusAction}>
                                  <input
                                    type="hidden"
                                    name="adminId"
                                    value={account.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="isActive"
                                    value={String(!account.isActive)}
                                  />
                                  <SubmitButton
                                    variant="secondary"
                                    pendingText={
                                      account.isActive ? "회수 중" : "활성화 중"
                                    }
                                    disabled={
                                      account.isActive
                                        ? !canRevoke
                                        : !canActivate
                                    }
                                  >
                                    {account.isActive
                                      ? "권한 회수"
                                      : "권한 활성화"}
                                  </SubmitButton>
                                </form>
                              ) : null}
                            </div>

                            {canUpdate ? (
                              <form
                                action={applyTemplateAction}
                                className="flex flex-wrap items-end gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="adminId"
                                  value={account.id}
                                />
                                <label className="grid min-w-52 gap-2 text-sm font-medium text-foreground">
                                  권한 템플릿 적용
                                  <select
                                    name="templateKey"
                                    className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm text-foreground"
                                    defaultValue={account.permissionId}
                                  >
                                    {templates.map((template) => (
                                      <option
                                        key={template.key}
                                        value={template.key}
                                      >
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
                                          defaultChecked={account.managedCampusSlugs.includes(
                                            campus.slug,
                                          )}
                                          className="h-4 w-4 accent-primary"
                                        />
                                        {campus.label}
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>
                                <SubmitButton
                                  variant="secondary"
                                  pendingText="적용 중"
                                >
                                  적용
                                </SubmitButton>
                              </form>
                            ) : null}
                          </Surface>
                        ) : (
                          <Surface level="inset" className="p-4 sm:p-5">
                            <p className="text-sm font-semibold text-foreground">
                              조회 전용 권한
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              현재 계정은 관리자 권한을 확인할 수 있지만 변경할
                              수 없습니다.
                            </p>
                          </Surface>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-4">
                            <p className="text-sm font-semibold text-foreground">
                              허용 리소스
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ADMIN_PERMISSION_RESOURCES.filter((resource) =>
                                Object.values(
                                  account.permissions[resource],
                                ).some(Boolean),
                              ).map((resource) => (
                                <Badge key={resource} variant="neutral">
                                  {getAdminPermissionResourceLabel(resource)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-4">
                            <p className="text-sm font-semibold text-foreground">
                              관리 캠퍼스
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {account.managedCampusSlugs.length > 0 ? (
                                account.managedCampusSlugs.map((slug) => (
                                  <Badge key={slug} variant="neutral">
                                    {CAMPUS_DIRECTORY.find(
                                      (campus) => campus.slug === slug,
                                    )?.label ?? slug}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  지역 제한 없음
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </Card>
                );
              })}
            </section>

            {canGrant ? (
              <aside className="lg:sticky lg:top-24 lg:order-2">
                <Card tone="muted" className="grid gap-4">
                  <AdminSectionHeading
                    title="관리자 추가"
                    description="가입된 Mattermost username과 권한 템플릿, 관리 캠퍼스를 지정합니다."
                  />
                  <form action={grantAction} className="grid gap-4">
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      회원 username
                      <Input
                        name="memberUsername"
                        required
                        placeholder="myknow"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      권한 템플릿
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
                    <fieldset className="grid gap-2">
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
                        지역 제휴 관리자 권한에만 적용됩니다.
                      </p>
                    </fieldset>
                    <SubmitButton pendingText="저장 중" className="w-full">
                      권한 부여
                    </SubmitButton>
                  </form>
                </Card>
              </aside>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
