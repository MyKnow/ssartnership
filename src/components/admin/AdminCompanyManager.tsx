import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import {
  createPartnerCompany,
  deletePartnerCompany,
  updatePartnerCompany,
} from "@/app/admin/(protected)/actions";

type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
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
    <label className={className}>
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

  return new Date(value).toLocaleString("ko-KR", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCompanyManager({
  companies,
}: {
  companies: AdminCompany[];
}) {
  return (
    <div className="mt-6 grid gap-5">
      <Card className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading
            title="협력사 추가"
            description="한 협력사 아래 여러 브랜드와 관리 계정을 연결할 수 있습니다."
          />
          <Badge className="bg-surface text-muted-foreground">
            총 {companies.length}개
          </Badge>
        </div>

        <form action={createPartnerCompany} className="grid gap-4 md:grid-cols-2">
          <FieldGroup label="협력사명">
            <Input name="companyName" placeholder="협력사명" required />
          </FieldGroup>
          <FieldGroup label="담당자 이름">
            <Input name="companyContactName" placeholder="담당자 이름" />
          </FieldGroup>
          <FieldGroup label="담당자 이메일">
            <Input
              name="companyContactEmail"
              type="email"
              placeholder="partner@example.com"
            />
          </FieldGroup>
          <FieldGroup label="담당자 전화번호">
            <Input name="companyContactPhone" placeholder="010-1234-5678" />
          </FieldGroup>
          <FieldGroup label="설명" className="md:col-span-2">
            <Textarea
              name="companyDescription"
              placeholder="포털에서 함께 보일 협력사 소개를 입력합니다."
              rows={3}
            />
          </FieldGroup>
          <div className="md:col-span-2 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center">
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
              식별자는 저장 시 자동 생성됩니다.
            </p>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <SubmitButton pendingText="추가 중" className="w-full sm:w-auto">
              협력사 추가
            </SubmitButton>
          </div>
        </form>
      </Card>

      {companies.length === 0 ? (
        <EmptyState
          title="협력사가 없습니다."
          description="새 협력사를 추가하면 이곳에서 목록을 관리할 수 있습니다."
        />
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => {
            const updateFormId = `company-update-${company.id}`;
            const deleteFormId = `company-delete-${company.id}`;
            const isActive = company.is_active !== false;
            const hasLinkedData = company.brandCount > 0 || company.accountCount > 0;

            return (
              <Card key={company.id} className="space-y-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          isActive
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-danger/10 text-danger"
                        }
                      >
                        {isActive ? "활성" : "비활성"}
                      </Badge>
                      <Badge className="bg-surface text-muted-foreground">
                        브랜드 {company.brandCount}개
                      </Badge>
                      <Badge className="bg-surface text-muted-foreground">
                        계정 {company.accountCount}개
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {company.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        식별자: {company.slug}
                      </p>
                      {company.description ? (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {company.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p>생성 {formatDateTime(company.created_at)}</p>
                    <p className="mt-1">수정 {formatDateTime(company.updated_at)}</p>
                  </div>
                </div>

                <form
                  id={updateFormId}
                  action={updatePartnerCompany}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <input type="hidden" name="companyId" value={company.id} />
                  <FieldGroup label="협력사명">
                    <Input name="companyName" defaultValue={company.name} required />
                  </FieldGroup>
                  <FieldGroup label="담당자 이름">
                    <Input
                      name="companyContactName"
                      defaultValue={company.contact_name ?? ""}
                    />
                  </FieldGroup>
                  <FieldGroup label="담당자 이메일">
                    <Input
                      name="companyContactEmail"
                      type="email"
                      defaultValue={company.contact_email ?? ""}
                    />
                  </FieldGroup>
                  <FieldGroup label="담당자 전화번호">
                    <Input
                      name="companyContactPhone"
                      defaultValue={company.contact_phone ?? ""}
                    />
                  </FieldGroup>
                  <FieldGroup label="설명" className="md:col-span-2">
                    <Textarea
                      name="companyDescription"
                      defaultValue={company.description ?? ""}
                      rows={3}
                    />
                  </FieldGroup>
                  <div className="md:col-span-2 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center">
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
                      협력사명 변경 시 식별자는 유지됩니다.
                    </p>
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <SubmitButton
                      form={updateFormId}
                      pendingText="저장 중"
                      className="w-full sm:w-auto"
                    >
                      협력사 저장
                    </SubmitButton>
                  </div>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {hasLinkedData
                      ? `연결된 브랜드 ${company.brandCount}개, 계정 ${company.accountCount}개가 있습니다. 삭제하면 연결이 해제됩니다.`
                      : "연결된 브랜드/계정이 없습니다. 바로 삭제할 수 있습니다."}
                  </p>
                  <form id={deleteFormId} action={deletePartnerCompany}>
                    <input type="hidden" name="companyId" value={company.id} />
                    <SubmitButton
                      form={deleteFormId}
                      variant="danger"
                      pendingText="삭제 중"
                      className="w-full sm:w-auto"
                    >
                      삭제
                    </SubmitButton>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
