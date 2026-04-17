import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import { updatePartnerAccountCompanyConnection } from "@/app/admin/(protected)/actions";
import FieldGroup from "@/components/admin/partner-account-manager/FieldGroup";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

type AdminCompany = {
  id: string;
  name: string;
  slug: string;
};

export default function PartnerAccountLinks({
  account,
  companies,
}: {
  account: AdminPartnerAccount;
  companies: AdminCompany[];
}) {
  const connectionFormId = `partner-account-company-connection-${account.id}`;

  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">협력사 연결</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            연결된 협력사마다 활성 상태를 조정할 수 있습니다.
          </p>
        </div>
      </div>

      <form
        id={connectionFormId}
        action={updatePartnerAccountCompanyConnection}
        className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <input type="hidden" name="accountId" value={account.id} />
        <FieldGroup label="협력사 선택">
          <Select name="companyId" defaultValue="" required disabled={companies.length === 0}>
            <option value="" disabled>
              협력사를 선택해 주세요
            </option>
            {companies.map((company) => {
              const isLinked = account.links.some(
                (link) => link.company?.id === company.id,
              );
              return (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.slug}){isLinked ? " · 연결됨" : ""}
                </option>
              );
            })}
          </Select>
        </FieldGroup>
        <FieldGroup label="연결 상태">
          <div className="flex h-11 items-center gap-3 rounded-[1rem] border border-border bg-surface px-3.5 text-sm font-medium text-foreground">
            <input type="hidden" name="isActive" value="false" />
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked
              disabled={companies.length === 0}
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
            disabled={companies.length === 0}
          >
            협력사 연결
          </SubmitButton>
        </div>
      </form>

      {companies.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          등록된 협력사가 없어 새 연결을 추가할 수 없습니다.
        </p>
      ) : null}

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
            <div key={link.id} className="rounded-2xl border border-border bg-surface p-4">
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
                <input type="hidden" name="companyId" value={link.company?.id ?? ""} />
                <FieldGroup label="연결 상태">
                  <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <input type="hidden" name="isActive" value="false" />
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
  );
}
