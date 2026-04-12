import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import PartnerInitialSetupUrlCopyButton from "@/components/admin/PartnerInitialSetupUrlCopyButton";
import {
  updatePartnerAccount,
  createPartnerAccountInitialSetupUrl,
  sendPartnerAccountInitialSetupUrl,
  updatePartnerAccountCompanyConnection,
} from "@/app/admin/(protected)/actions";

type AdminPartnerAccountCompany = {
  id: string;
  is_active?: boolean | null;
  created_at?: string | null;
  company?:
    | {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        contact_name?: string | null;
        contact_email?: string | null;
        contact_phone?: string | null;
        is_active?: boolean | null;
      }
    | null;
};

type AdminPartnerAccount = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_token?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links: AdminPartnerAccountCompany[];
};

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "없음";
  }
  return new Date(value).toLocaleString("ko-KR", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPartnerAccountManager({
  accounts,
}: {
  accounts: AdminPartnerAccount[];
}) {
  if (accounts.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          title="협력사 계정이 없습니다."
          description="협력사를 추가하면 담당자 계정이 함께 나타납니다."
        />
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {accounts.map((account) => {
        const accountFormId = `partner-account-form-${account.id}`;

        return (
          <article
            key={account.id}
            className="rounded-3xl border border-border bg-surface-elevated p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      account.is_active
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-danger/10 text-danger"
                    }
                  >
                    {account.is_active ? "활성" : "비활성"}
                  </Badge>
                  <Badge
                    className={
                      account.must_change_password
                        ? "bg-amber-500/10 text-amber-700"
                        : "bg-surface text-muted-foreground"
                    }
                  >
                    {account.must_change_password ? "비밀번호 변경 필요" : "일반"}
                  </Badge>
                  <Badge className="bg-surface text-muted-foreground">
                    협력사 연결 {account.links.length}개
                  </Badge>
                  <Badge
                    className={
                      account.initial_setup_completed_at
                        ? "bg-emerald-500/10 text-emerald-700"
                        : account.initial_setup_token
                          ? "bg-sky-500/10 text-sky-700"
                          : "bg-surface text-muted-foreground"
                    }
                  >
                    {account.initial_setup_completed_at
                      ? "초기 설정 완료"
                      : account.initial_setup_token
                        ? account.initial_setup_link_sent_at
                          ? "초기설정 URL 전송됨"
                          : "초기설정 URL 준비됨"
                        : "초기설정 URL 미생성"}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {account.display_name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    로그인 아이디: {account.login_id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    이메일 인증: {formatDateTime(account.email_verified_at)}
                    {" · "}
                    마지막 로그인: {formatDateTime(account.last_login_at)}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="break-all">계정 ID</p>
                <p className="mt-1 break-all font-mono text-foreground">
                  {account.id}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:items-end">
                  {!account.initial_setup_completed_at &&
                  account.is_active !== false ? (
                    <form action={createPartnerAccountInitialSetupUrl}>
                      <input type="hidden" name="id" value={account.id} />
                      <SubmitButton
                        pendingText="생성 중"
                        variant="ghost"
                        className="w-full sm:w-auto"
                      >
                        {account.initial_setup_token
                          ? "초기설정 URL 재생성"
                          : "초기설정 URL 생성"}
                      </SubmitButton>
                    </form>
                  ) : null}
                  {account.initial_setup_token ? (
                    <PartnerInitialSetupUrlCopyButton
                      setupUrl={new URL(
                        `/partner/setup/${account.initial_setup_token}`,
                        process.env.NEXT_PUBLIC_SITE_URL ?? "https://ssartnership.vercel.app",
                      ).toString()}
                    />
                  ) : null}
                  {!account.initial_setup_completed_at &&
                  account.is_active !== false ? (
                    <form action={sendPartnerAccountInitialSetupUrl}>
                      <input type="hidden" name="id" value={account.id} />
                      <SubmitButton
                        pendingText="전송 중"
                        className="w-full sm:w-auto"
                      >
                        {account.initial_setup_link_sent_at
                          ? "초기설정 URL 재전송"
                          : "초기설정 URL 메일 전송"}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      계정 정보
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      로그인 아이디, 표시명, 활성 상태를 관리합니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-surface text-muted-foreground">
                      생성 {formatDateTime(account.created_at)}
                    </Badge>
                    <Badge className="bg-surface text-muted-foreground">
                      수정 {formatDateTime(account.updated_at)}
                    </Badge>
                  </div>
                </div>

                <form
                  id={accountFormId}
                  action={updatePartnerAccount}
                  className="mt-4 grid gap-4 md:grid-cols-2"
                >
                  <input type="hidden" name="id" value={account.id} />
                  <FieldGroup label="로그인 아이디(이메일)">
                    <Input
                      name="loginId"
                      type="email"
                      defaultValue={account.login_id}
                      autoComplete="email"
                      required
                    />
                  </FieldGroup>
                  <FieldGroup label="표시명">
                    <Input
                      name="displayName"
                      defaultValue={account.display_name}
                      autoComplete="name"
                      required
                    />
                  </FieldGroup>

                  <div className="md:col-span-2 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
                    <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <input
                        type="hidden"
                        name="isActive"
                        value="false"
                      />
                      <input
                        type="checkbox"
                        name="isActive"
                        value="true"
                        defaultChecked={account.is_active !== false}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      계정 활성
                    </label>
                    <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <input
                        type="hidden"
                        name="mustChangePassword"
                        value="false"
                      />
                      <input
                        type="checkbox"
                        name="mustChangePassword"
                        value="true"
                        defaultChecked={Boolean(account.must_change_password)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      다음 로그인 시 비밀번호 변경
                    </label>
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <SubmitButton
                      pendingText="저장 중"
                      form={accountFormId}
                      className="w-full sm:w-auto"
                    >
                      계정 저장
                    </SubmitButton>
                  </div>
                </form>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      협력사 연결
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      연결된 협력사마다 활성 상태를 조정할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {account.links.length === 0 ? (
                  <EmptyState
                    title="연결된 협력사가 없습니다."
                    description="이 계정에 연결할 협력사를 추가해 주세요."
                  />
                  ) : null}
                  {account.links.map((link) => {
                    const linkFormId = `partner-account-link-${account.id}-${link.id}`;
                    return (
                      <div
                        key={link.id}
                        className="rounded-2xl border border-border bg-surface p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {link.company?.name ?? "협력사 정보 없음"}
                            </p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {link.company?.slug ?? link.company?.id ?? link.id}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={
                                link.is_active !== false
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-danger/10 text-danger"
                              }
                            >
                              {link.is_active !== false ? "활성" : "비활성"}
                            </Badge>
                          </div>
                        </div>

                        <form
                          id={linkFormId}
                          action={updatePartnerAccountCompanyConnection}
                          className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <input type="hidden" name="accountId" value={account.id} />
                          <input
                            type="hidden"
                            name="companyId"
                            value={link.company?.id ?? ""}
                          />
                          <FieldGroup label="연결 상태">
                            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                              <input
                                type="hidden"
                                name="isActive"
                                value="false"
                              />
                              <input
                                type="checkbox"
                                name="isActive"
                                value="true"
                                defaultChecked={link.is_active !== false}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                              />
                              연결 활성
                            </div>
                          </FieldGroup>
                          <div className="flex items-end justify-end">
                            <SubmitButton
                              pendingText="저장 중"
                              form={linkFormId}
                              className="w-full sm:w-auto"
                            >
                              연결 저장
                            </SubmitButton>
                          </div>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
