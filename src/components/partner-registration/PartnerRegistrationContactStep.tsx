import {
  PartnerRegistrationField as Field,
  PartnerRegistrationInput as FormInput,
  PartnerRegistrationTextarea as FormTextarea,
} from "./PartnerRegistrationFields";
import type {
  PartnerRegistrationFieldErrors,
  PartnerRegistrationFieldName,
  PartnerRegistrationFormState,
} from "@/lib/partner-registration";

export default function PartnerRegistrationContactStep({
  active,
  fieldErrors,
  registerFieldRef,
  initialValues,
  lockCompanyName,
}: {
  active: boolean;
  fieldErrors: PartnerRegistrationFieldErrors;
  registerFieldRef: (
    fieldName: PartnerRegistrationFieldName,
  ) => (element: HTMLElement | null) => void;
  initialValues?: Partial<PartnerRegistrationFormState>;
  lockCompanyName: boolean;
}) {
  return (
    <section
      hidden={!active}
      className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">
          파트너사와 담당자
        </h2>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
          운영자가 추가 확인과 포털 계정 안내를 위해 연락할 정보입니다.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field
          label="파트너사명"
          name="companyName"
          required
          error={fieldErrors.companyName}
        >
          <FormInput
            name="companyName"
            fieldErrors={fieldErrors}
            inputRef={registerFieldRef("companyName")}
            required
            readOnly={lockCompanyName}
            defaultValue={initialValues?.companyName}
            className={lockCompanyName ? "bg-surface-muted" : undefined}
            placeholder="카페 싸피"
          />
        </Field>
        <Field
          label="담당자명"
          name="contactName"
          required
          error={fieldErrors.contactName}
        >
          <FormInput
            name="contactName"
            fieldErrors={fieldErrors}
            inputRef={registerFieldRef("contactName")}
            required
            defaultValue={initialValues?.contactName}
            placeholder="김싸피"
          />
        </Field>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field
          label="담당자 이메일"
          name="contactEmail"
          required
          error={fieldErrors.contactEmail}
        >
          <FormInput
            type="email"
            name="contactEmail"
            fieldErrors={fieldErrors}
            inputRef={registerFieldRef("contactEmail")}
            required
            defaultValue={initialValues?.contactEmail}
            placeholder="partner@cafessafy.example"
          />
        </Field>
        <Field
          label="담당자 전화번호"
          name="contactPhone"
          error={fieldErrors.contactPhone}
        >
          <FormInput
            name="contactPhone"
            fieldErrors={fieldErrors}
            inputRef={registerFieldRef("contactPhone")}
            defaultValue={initialValues?.contactPhone}
            placeholder="010-1500-1234"
          />
        </Field>
      </div>

      <Field
        label="파트너사 설명"
        name="companyDescription"
        error={fieldErrors.companyDescription}
      >
        <FormTextarea
          name="companyDescription"
          fieldErrors={fieldErrors}
          inputRef={registerFieldRef("companyDescription")}
          rows={3}
          defaultValue={initialValues?.companyDescription}
          placeholder="여러 지점을 운영하는 프랜차이즈 카페"
        />
      </Field>

      <Field label="메모" name="memo" error={fieldErrors.memo}>
        <FormTextarea
          name="memo"
          fieldErrors={fieldErrors}
          inputRef={registerFieldRef("memo")}
          rows={3}
          defaultValue={initialValues?.memo}
          placeholder="등록 전 운영자에게 전달할 내용을 입력해 주세요."
        />
      </Field>
    </section>
  );
}
