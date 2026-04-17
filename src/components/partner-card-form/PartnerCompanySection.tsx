import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import FieldGroup from "@/components/partner-card-form/FieldGroup";
import { getPartnerCardInvalidClass } from "@/components/partner-card-form/usePartnerCardFormState";
import type {
  PartnerCardCompanyOption,
  PartnerCardFormField,
} from "@/components/partner-card-form/types";

export default function PartnerCompanySection({
  companyOptions,
  fieldErrors,
  focusField,
  companyFieldsLocked,
  values,
  setters,
}: {
  companyOptions?: PartnerCardCompanyOption[];
  fieldErrors?: Partial<Record<PartnerCardFormField, string>>;
  focusField?: PartnerCardFormField;
  companyFieldsLocked: boolean;
  values: {
    selectedCompanyId: string;
    companyNameValue: string;
    companyContactNameValue: string;
    companyContactEmailValue: string;
    companyContactPhoneValue: string;
    companyDescriptionValue: string;
  };
  setters: {
    setSelectedCompanyId: (value: string) => void;
    setCompanyNameValue: (value: string) => void;
    setCompanyContactNameValue: (value: string) => void;
    setCompanyContactEmailValue: (value: string) => void;
    setCompanyContactPhoneValue: (value: string) => void;
    setCompanyDescriptionValue: (value: string) => void;
  };
}) {
  return (
    <Card className="overflow-hidden">
      <SectionHeading
        title="협력사 / 담당자"
        description="한 협력사가 여러 브랜드를 가질 수 있으니, 기존 협력사를 연결하거나 새 협력사를 생성합니다."
      />

      <div className="mt-6 grid gap-5">
        <FieldGroup label="기존 협력사 연결" error={fieldErrors?.companyId}>
          <Select
            name="companyId"
            value={values.selectedCompanyId}
            onChange={(event) => setters.setSelectedCompanyId(event.target.value)}
            autoFocus={focusField === "companyId"}
            aria-invalid={Boolean(fieldErrors?.companyId) || undefined}
            className={getPartnerCardInvalidClass(Boolean(fieldErrors?.companyId))}
          >
            <option value="">새 협력사 생성</option>
            {(companyOptions ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {companyFieldsLocked
              ? "기존 협력사를 선택했으므로 아래 협력사명, 담당자 정보, 설명은 잠깁니다. 협력사 정보 수정은 /admin/companies에서 진행하세요."
              : "기존 협력사를 선택하면 아래 협력사명, 담당자 정보, 설명은 사용되지 않습니다. 협력사 정보 수정은 /admin/companies에서 진행하세요."}
          </p>
        </FieldGroup>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="협력사명" error={fieldErrors?.companyName}>
            <Input
              name="companyName"
              value={values.companyNameValue}
              onChange={(event) => setters.setCompanyNameValue(event.target.value)}
              placeholder="협력사명"
              disabled={companyFieldsLocked}
              autoFocus={focusField === "companyName"}
              aria-invalid={Boolean(fieldErrors?.companyName) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.companyName))}
            />
          </FieldGroup>
          <FieldGroup label="담당자 이름" error={fieldErrors?.companyContactName}>
            <Input
              name="companyContactName"
              value={values.companyContactNameValue}
              onChange={(event) => setters.setCompanyContactNameValue(event.target.value)}
              placeholder="담당자 이름"
              disabled={companyFieldsLocked}
              autoFocus={focusField === "companyContactName"}
              aria-invalid={Boolean(fieldErrors?.companyContactName) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.companyContactName))}
            />
          </FieldGroup>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="담당자 이메일" error={fieldErrors?.companyContactEmail}>
            <Input
              name="companyContactEmail"
              type="email"
              value={values.companyContactEmailValue}
              onChange={(event) => setters.setCompanyContactEmailValue(event.target.value)}
              placeholder="partner@example.com"
              disabled={companyFieldsLocked}
              autoFocus={focusField === "companyContactEmail"}
              aria-invalid={Boolean(fieldErrors?.companyContactEmail) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.companyContactEmail))}
            />
          </FieldGroup>
          <FieldGroup label="담당자 전화번호" error={fieldErrors?.companyContactPhone}>
            <Input
              name="companyContactPhone"
              value={values.companyContactPhoneValue}
              onChange={(event) => setters.setCompanyContactPhoneValue(event.target.value)}
              placeholder="010-1234-5678"
              disabled={companyFieldsLocked}
              autoFocus={focusField === "companyContactPhone"}
              aria-invalid={Boolean(fieldErrors?.companyContactPhone) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.companyContactPhone))}
            />
          </FieldGroup>
        </div>

        <FieldGroup label="협력사 설명" error={fieldErrors?.companyDescription}>
          <Textarea
            name="companyDescription"
            value={values.companyDescriptionValue}
            onChange={(event) => setters.setCompanyDescriptionValue(event.target.value)}
            rows={3}
            placeholder="포털에서 함께 보일 협력사 소개를 입력합니다."
            disabled={companyFieldsLocked}
            autoFocus={focusField === "companyDescription"}
            aria-invalid={Boolean(fieldErrors?.companyDescription) || undefined}
            className={getPartnerCardInvalidClass(Boolean(fieldErrors?.companyDescription))}
          />
        </FieldGroup>

        <p className="text-xs leading-5 text-muted-foreground">
          {companyFieldsLocked
            ? "기존 협력사를 연결할 때는 아래 입력값이 저장에 반영되지 않습니다."
            : "담당자 이메일은 이후 포털 로그인 아이디와 초기 설정 안내에 사용됩니다. 기존 협력사를 연결할 때는 비워 두고 저장해도 됩니다."}
        </p>
      </div>
    </Card>
  );
}
