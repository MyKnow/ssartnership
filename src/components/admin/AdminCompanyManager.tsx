import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import {
  createPartnerCompany,
  deletePartnerCompany,
  updatePartnerCompany,
} from "@/app/admin/(protected)/actions";
import CompanyAccountConnections from "@/components/admin/company-manager/CompanyAccountConnections";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  brandCount: number;
  accountCount: number;
};

function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm font-medium text-foreground", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
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

export default function AdminCompanyManager({
  companies,
  accounts,
}: {
  companies: AdminCompany[];
  accounts: AdminPartnerAccount[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:items-start xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <aside className="md:sticky md:top-24 md:order-2">
        <Card tone="muted" padding="md" className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading
              title="협력사 추가"
              description="한 협력사를 먼저 만들고, 브랜드와 관리 계정을 이어서 연결합니다."
            />
            <Badge variant="neutral">
              총 {companies.length}개
            </Badge>
          </div>

          <form action={createPartnerCompany} className="grid gap-4">
            <FieldGroup label="협력사명">
              <Input name="companyName" placeholder="협력사명" required />
            </FieldGroup>
            <FieldGroup label="설명">
              <Textarea
                name="companyDescription"
                placeholder="포털과 관리자 화면에 함께 보일 협력사 소개를 입력합니다."
                rows={5}
              />
            </FieldGroup>

            <div className="grid gap-4 rounded-2xl border border-border/70 bg-surface-inset/85 p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">기본 상태</h4>
                <p className="text-xs leading-5 text-muted-foreground">
                  비활성으로 저장하면 연결된 브랜드와 계정은 유지되고, 상태만 내려갑니다.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  name="companyIsActive"
                  value="true"
                  defaultChecked
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                협력사 활성
              </label>
              <p className="text-xs text-muted-foreground">
                식별자(`slug`)는 저장 시 자동 생성되고 이후에도 유지됩니다.
              </p>
              <SubmitButton pendingText="추가 중" className="w-full">
                협력사 추가
              </SubmitButton>
            </div>
          </form>
        </Card>
      </aside>

      <section className="grid min-w-0 gap-4 md:order-1">
        {companies.length === 0 ? (
          <Card tone="elevated" padding="md">
            <EmptyState
              title="협력사가 없습니다."
              description="새 협력사를 추가하면 이곳에서 목록을 관리할 수 있습니다."
            />
          </Card>
        ) : (
          <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading
              title="협력사 목록"
              description="기본 정보와 연결 수를 먼저 훑고, 필요한 항목만 펼쳐 수정합니다."
            />
            <Badge variant="neutral">{companies.length}개</Badge>
          </div>

          {companies.map((company) => {
            const updateFormId = `company-update-${company.id}`;
            const deleteFormId = `company-delete-${company.id}`;
            const isActive = company.is_active !== false;
            const hasLinkedData = company.brandCount > 0 || company.accountCount > 0;

            return (
              <Card key={company.id} padding="none" className="overflow-hidden">
                <details className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-5 py-4 transition hover:bg-surface-muted/50 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={isActive ? "success" : "danger"}>
                          {isActive ? "활성" : "비활성"}
                        </Badge>
                        <Badge variant="neutral">
                          브랜드 {company.brandCount}개
                        </Badge>
                        <Badge variant="neutral">
                          계정 {company.accountCount}개
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-foreground">
                          {company.name}
                        </h3>
                        <p className="mt-1 break-all text-sm text-muted-foreground">
                          slug · {company.slug}
                        </p>
                        {company.description ? (
                          <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                            {company.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-muted-foreground md:min-w-[18rem] md:justify-items-end">
                      <p>생성 {formatDateTime(company.created_at)}</p>
                      <p>수정 {formatDateTime(company.updated_at)}</p>
                      <span className="text-xs font-semibold text-primary">
                        펼쳐서 수정
                      </span>
                    </div>
                  </summary>

                  <div className="grid gap-5 border-t border-border/70 bg-surface-inset/40 p-5 md:p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
                  <form
                    id={updateFormId}
                    action={updatePartnerCompany}
                    className="grid gap-4 rounded-2xl border border-border/70 bg-surface-inset/80 p-4"
                  >
                    <input type="hidden" name="companyId" value={company.id} />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">기본 정보 수정</h4>
                      <p className="text-xs leading-5 text-muted-foreground">
                        협력사명과 설명을 정리하고 활성 상태를 조정합니다.
                      </p>
                    </div>
                    <FieldGroup label="협력사명">
                      <Input name="companyName" defaultValue={company.name} required />
                    </FieldGroup>
                    <FieldGroup label="설명">
                      <Textarea
                        name="companyDescription"
                        defaultValue={company.description ?? ""}
                        rows={4}
                      />
                    </FieldGroup>
                    <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface-muted/70 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          name="companyIsActive"
                          value="true"
                          defaultChecked={isActive}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        협력사 활성
                      </label>
                      <p className="text-xs text-muted-foreground">
                        협력사명 변경 시 slug는 유지됩니다.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <SubmitButton
                        form={updateFormId}
                        pendingText="저장 중"
                        className="w-full sm:w-auto"
                      >
                        협력사 저장
                      </SubmitButton>
                    </div>
                  </form>

                  <div className="grid gap-4">
                    <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset/80 p-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">연결 현황</h4>
                        <p className="text-xs leading-5 text-muted-foreground">
                          삭제 전에 현재 연결 상태를 먼저 확인합니다.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-surface-muted/70 p-4">
                          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">
                            연결 브랜드
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {company.brandCount}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-surface-muted/70 p-4">
                          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">
                            연결 계정
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">
                            {company.accountCount}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-danger/20 bg-danger/5 p-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">삭제</h4>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {hasLinkedData
                            ? `연결된 브랜드 ${company.brandCount}개, 계정 ${company.accountCount}개가 있어 삭제 시 연결이 함께 해제됩니다.`
                            : "연결된 브랜드와 계정이 없어 바로 삭제할 수 있습니다."}
                        </p>
                      </div>
                      <form id={deleteFormId} action={deletePartnerCompany}>
                        <input type="hidden" name="companyId" value={company.id} />
                        <SubmitButton
                          form={deleteFormId}
                          variant="danger"
                          pendingText="삭제 중"
                          className="w-full sm:w-auto"
                        >
                          협력사 삭제
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </div>

                  <CompanyAccountConnections company={company} accounts={accounts} />
                </details>
              </Card>
            );
          })}
          </>
        )}
      </section>
    </div>
  );
}
