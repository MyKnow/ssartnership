"use client";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { updatePartnerAccountCompanyConnection } from "@/app/admin/(protected)/actions";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

type CompanySummary = {
  id: string;
  name: string;
  slug: string;
};

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "없음";
  }

  return formatKoreanDateTimeToMinute(value);
}

export default function CompanyAccountConnections({
  company,
  accounts,
}: {
  company: CompanySummary;
  accounts: AdminPartnerAccount[];
}) {
  const linkedAccounts = accounts.flatMap((account) =>
    account.links
      .filter((link) => link.company?.id === company.id)
      .map((link) => ({
        account,
        link,
      })),
  );

  const connectionFormId = `company-account-connection-${company.id}`;

  return (
    <div className="grid gap-4 rounded-2xl border border-border/70 bg-surface-inset/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">기존 계정 연결</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            이미 존재하는 계정을 선택해 이 협력사를 관리하도록 추가합니다.
          </p>
        </div>
        <Badge variant="neutral">
          연결 {linkedAccounts.length}개
        </Badge>
      </div>

      <form
        id={connectionFormId}
        action={updatePartnerAccountCompanyConnection}
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <input type="hidden" name="companyId" value={company.id} />
        <FieldGroup label="관리 계정">
          <Select name="accountId" defaultValue="" required disabled={accounts.length === 0}>
            <option value="" disabled>
              계정을 선택해 주세요
            </option>
            {accounts.map((account) => {
              const isLinked = account.links.some(
                (link) => link.company?.id === company.id,
              );
              return (
                <option key={account.id} value={account.id}>
                  {account.display_name} ({account.login_id})
                  {isLinked ? " · 연결됨" : ""}
                </option>
              );
            })}
          </Select>
        </FieldGroup>
        <FieldGroup label="연결 상태">
          <div className="flex h-11 items-center gap-3 rounded-[1rem] border border-border/70 bg-surface-muted/70 px-3.5 text-sm font-medium text-foreground">
            <input type="hidden" name="isActive" value="false" />
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked
              disabled={accounts.length === 0}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            연결 활성
          </div>
        </FieldGroup>
        <div className="flex items-end">
          <SubmitButton
            form={connectionFormId}
            pendingText="연결 중"
            className="w-full md:w-auto"
            disabled={accounts.length === 0}
          >
            기존 계정 연결
          </SubmitButton>
        </div>
      </form>

      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          등록된 계정이 없어 새 연결을 추가할 수 없습니다.
        </p>
      ) : null}

      <div className="space-y-3">
        {linkedAccounts.length === 0 ? (
          <EmptyState
            title="연결된 계정이 없습니다."
            description="위 드롭박스로 기존 계정을 선택해 이 협력사의 관리 권한을 추가하세요."
          />
        ) : (
          linkedAccounts.map(({ account, link }) => {
            const linkFormId = `company-account-link-${company.id}-${account.id}`;
            return (
              <div
                key={`${company.id}:${account.id}`}
                className="grid gap-4 rounded-2xl border border-border/70 bg-surface-muted/70 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {account.display_name}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {account.login_id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    연결 {formatDateTime(link.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <Badge variant={link.is_active !== false ? "success" : "danger"}>
                    {link.is_active !== false ? "활성" : "비활성"}
                  </Badge>
                  <form
                    id={linkFormId}
                    action={updatePartnerAccountCompanyConnection}
                    className="grid gap-3 sm:grid-cols-[auto_auto]"
                  >
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <FieldGroup label="연결 활성">
                      <div className="flex h-11 items-center gap-3 rounded-[1rem] border border-border/70 bg-surface-inset px-3.5 text-sm font-medium text-foreground">
                        <input type="hidden" name="isActive" value="false" />
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={link.is_active !== false}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        활성 유지
                      </div>
                    </FieldGroup>
                    <div className="flex items-end">
                      <SubmitButton
                        form={linkFormId}
                        pendingText="저장 중"
                        className="w-full sm:w-auto"
                      >
                        상태 저장
                      </SubmitButton>
                    </div>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
