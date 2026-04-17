"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import SectionHeading from "@/components/ui/SectionHeading";
import { createPartnerAccount } from "@/app/admin/(protected)/actions";
import FieldGroup from "@/components/admin/partner-account-manager/FieldGroup";

type CompanySummary = {
  id: string;
  name: string;
  slug: string;
};

export default function PartnerAccountCreateForm({
  companies,
}: {
  companies: CompanySummary[];
}) {
  const formId = "partner-account-create-form";
  const hasCompanies = companies.length > 0;

  return (
    <Card tone="muted" padding="md" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="계정 추가"
          description="새 협력사 계정을 만들고 첫 연결 협력사를 함께 지정합니다."
        />
        <Badge variant="neutral">
          {hasCompanies ? "협력사 선택 가능" : "협력사 먼저 추가"}
        </Badge>
      </div>

      <form
        id={formId}
        action={createPartnerAccount}
        className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldGroup label="로그인 아이디(이메일)">
            <Input
              name="loginId"
              type="email"
              placeholder="partner@example.com"
              autoComplete="email"
              required
            />
          </FieldGroup>
          <FieldGroup label="표시명">
            <Input
              name="displayName"
              placeholder="담당자 이름"
              autoComplete="name"
              required
            />
          </FieldGroup>
          <FieldGroup label="첫 연결 협력사" className="md:col-span-2">
            <Select
              name="companyId"
              defaultValue=""
              required
              disabled={!hasCompanies}
            >
              <option value="" disabled>
                협력사를 선택해 주세요
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.slug})
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">생성 옵션</h4>
            <p className="text-xs leading-5 text-muted-foreground">
              활성 상태로 만들면 초기설정 URL과 메일 전송 흐름을 이어서 사용할 수 있습니다.
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <input type="hidden" name="isActive" value="false" />
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            계정 활성
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            계정 생성 후에는 아래 목록에서 다른 협력사를 추가로 연결할 수 있습니다.
          </p>
          <SubmitButton
            form={formId}
            pendingText="추가 중"
            className="w-full sm:w-auto"
            disabled={!hasCompanies}
          >
            계정 추가
          </SubmitButton>
        </div>
      </form>

      {!hasCompanies ? (
        <p className="text-xs text-muted-foreground">
          협력사를 먼저 추가해야 계정을 생성할 수 있습니다.
        </p>
      ) : null}
    </Card>
  );
}
