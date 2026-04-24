"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import { sanitizeHttpUrl } from "@/lib/validation";

const initialState = {
  companyName: "",
  businessArea: "",
  partnershipConditions: "",
  contactName: "",
  contactRole: "",
  contactEmail: "",
  companyUrl: "",
};

type SuggestFormState = typeof initialState;
type SuggestFieldName = keyof SuggestFormState;
type SuggestFieldErrors = Partial<Record<SuggestFieldName, string>>;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requiredFieldLabels: Record<Exclude<SuggestFieldName, "companyUrl">, string> = {
  companyName: "업체명을 입력해 주세요.",
  businessArea: "업체 분야 소개를 입력해 주세요.",
  partnershipConditions: "제안 제휴 조건을 입력해 주세요.",
  contactName: "담당자 이름을 입력해 주세요.",
  contactRole: "담당자 직위를 입력해 주세요.",
  contactEmail: "담당자 이메일을 입력해 주세요.",
};

const fieldOrder: SuggestFieldName[] = [
  "companyName",
  "businessArea",
  "partnershipConditions",
  "companyUrl",
  "contactName",
  "contactRole",
  "contactEmail",
];

const invalidFieldClassName =
  "border-danger/50 bg-danger/5 focus:border-danger focus:ring-danger/15";

function validateSuggestForm(values: SuggestFormState): SuggestFieldErrors {
  const errors: SuggestFieldErrors = {};

  for (const [fieldName, message] of Object.entries(requiredFieldLabels) as [
    Exclude<SuggestFieldName, "companyUrl">,
    string,
  ][]) {
    if (!values[fieldName].trim()) {
      errors[fieldName] = message;
    }
  }

  if (values.contactEmail.trim() && !emailRegex.test(values.contactEmail.trim())) {
    errors.contactEmail = "이메일 형식을 확인해 주세요.";
  }

  if (values.companyUrl.trim() && !sanitizeHttpUrl(values.companyUrl)) {
    errors.companyUrl = "회사 사이트 URL 형식을 확인해 주세요.";
  }

  return errors;
}

function SuggestField({
  label,
  description,
  required = false,
  error,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="ui-caption inline-flex items-center gap-1">
        {label}
        {required ? (
          <span className="text-danger" aria-label="필수 입력">
            *
          </span>
        ) : (
          <span className="font-medium tracking-normal text-muted-foreground/80">
            선택
          </span>
        )}
      </span>
      {children}
      {description ? (
        <span className="text-xs leading-5 text-muted-foreground">{description}</span>
      ) : null}
      {error ? (
        <span className="text-xs font-medium leading-5 text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export default function SuggestForm() {
  const [formState, setFormState] = useState(initialState);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SuggestFieldErrors>({});
  const fieldRefs = useRef<Partial<Record<SuggestFieldName, HTMLElement | null>>>({});
  const router = useRouter();

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    const fieldName = name as SuggestFieldName;
    setFormState((prev) => ({ ...prev, [fieldName]: value }));
    setFieldErrors((prev) => {
      if (!prev[fieldName]) {
        return prev;
      }
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setConfirmOpen(false);

    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setErrorMessage(
          data?.message ?? "메일 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
        setSubmitting(false);
        return;
      }
    } catch {
      setErrorMessage("메일 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem("suggest:submitted", "1");
    }
    setSubmitting(false);
    router.replace("/");
  };

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();

        const nextFieldErrors = validateSuggestForm(formState);
        setFieldErrors(nextFieldErrors);

        const firstInvalidField = fieldOrder.find(
          (fieldName) => nextFieldErrors[fieldName],
        );
        if (firstInvalidField) {
          setErrorMessage("입력값을 확인해 주세요.");
          fieldRefs.current[firstInvalidField]?.focus();
          return;
        }

        setErrorMessage(null);
        setConfirmOpen(true);
      }}
    >
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
      <InlineMessage
        title="접수 안내"
        description="제출하면 입력한 담당자 이메일로 접수 사본이 발송됩니다."
        className="py-3.5"
      />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">제휴 내용</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            SSAFY 구성원이 받을 수 있는 혜택과 이용 조건을 중심으로 작성해 주세요.
          </p>
        </div>

        <SuggestField label="업체명" required error={fieldErrors.companyName}>
          <Input
            ref={(element) => {
              fieldRefs.current.companyName = element;
            }}
            name="companyName"
            value={formState.companyName}
            onChange={handleChange}
            required
            aria-invalid={Boolean(fieldErrors.companyName)}
            className={fieldErrors.companyName ? invalidFieldClassName : undefined}
            placeholder="예: 싸트너십 카페"
          />
        </SuggestField>

        <SuggestField
          label="업체 분야 소개"
          description="업종, 위치, 주요 서비스가 드러나면 검토가 빨라집니다."
          required
          error={fieldErrors.businessArea}
        >
          <Textarea
            ref={(element) => {
              fieldRefs.current.businessArea = element;
            }}
            name="businessArea"
            value={formState.businessArea}
            onChange={handleChange}
            rows={4}
            required
            aria-invalid={Boolean(fieldErrors.businessArea)}
            className={fieldErrors.businessArea ? invalidFieldClassName : undefined}
            placeholder="예: 역삼역 인근 베이커리 카페입니다. SSAFY 교육생이 쉬는 시간이나 스터디 후 이용하기 좋습니다."
          />
        </SuggestField>

        <SuggestField
          label="제안 제휴 조건"
          description="할인율, 제공 혜택, 인증 방식, 사용 가능 기간 등을 적어 주세요."
          required
          error={fieldErrors.partnershipConditions}
        >
          <Textarea
            ref={(element) => {
              fieldRefs.current.partnershipConditions = element;
            }}
            name="partnershipConditions"
            value={formState.partnershipConditions}
            onChange={handleChange}
            rows={4}
            required
            aria-invalid={Boolean(fieldErrors.partnershipConditions)}
            className={
              fieldErrors.partnershipConditions ? invalidFieldClassName : undefined
            }
            placeholder="예: SSAFY 인증 화면 제시 시 전 메뉴 10% 할인, 평일 11:00~17:00 사용 가능"
          />
        </SuggestField>

        <SuggestField
          label="회사 사이트 URL"
          description="선택 입력입니다. 홈페이지, 인스타그램, 네이버 플레이스 모두 가능합니다."
          error={fieldErrors.companyUrl}
        >
          <Input
            ref={(element) => {
              fieldRefs.current.companyUrl = element;
            }}
            name="companyUrl"
            value={formState.companyUrl}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.companyUrl)}
            className={fieldErrors.companyUrl ? invalidFieldClassName : undefined}
            placeholder="https://example.com"
          />
        </SuggestField>
      </section>

      <section className="space-y-4 border-t border-border/70 pt-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">담당자 정보</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            접수 확인과 추가 논의를 위해 연락 가능한 정보를 입력해 주세요.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SuggestField label="담당자 이름" required error={fieldErrors.contactName}>
            <Input
              ref={(element) => {
                fieldRefs.current.contactName = element;
              }}
              name="contactName"
              value={formState.contactName}
              onChange={handleChange}
              required
              aria-invalid={Boolean(fieldErrors.contactName)}
              className={fieldErrors.contactName ? invalidFieldClassName : undefined}
              autoComplete="name"
            />
          </SuggestField>
          <SuggestField label="담당자 직위" required error={fieldErrors.contactRole}>
            <Input
              ref={(element) => {
                fieldRefs.current.contactRole = element;
              }}
              name="contactRole"
              value={formState.contactRole}
              onChange={handleChange}
              required
              aria-invalid={Boolean(fieldErrors.contactRole)}
              className={fieldErrors.contactRole ? invalidFieldClassName : undefined}
              placeholder="예: 매니저, 대표"
            />
          </SuggestField>
        </div>

        <SuggestField label="담당자 이메일" required error={fieldErrors.contactEmail}>
          <Input
            ref={(element) => {
              fieldRefs.current.contactEmail = element;
            }}
            type="email"
            name="contactEmail"
            value={formState.contactEmail}
            onChange={handleChange}
            required
            aria-invalid={Boolean(fieldErrors.contactEmail)}
            className={fieldErrors.contactEmail ? invalidFieldClassName : undefined}
            placeholder="example@domain.com"
            autoComplete="email"
          />
        </SuggestField>
      </section>

      <div className="flex flex-col gap-3 rounded-card border border-border/70 bg-surface-muted/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">
          제출 전 연락처와 혜택 조건을 한 번 더 확인해 주세요.
        </p>
        <Button
          type="submit"
          className="w-full justify-center sm:min-w-[140px] sm:w-auto"
          loading={isSubmitting}
          loadingText="제출 중"
        >
          제안 제출
        </Button>
      </div>
      <Modal
        open={isConfirmOpen}
        title="제휴 제안 제출"
        description="제안을 제출할까요? 제출 후 홈 화면으로 이동합니다."
        onClose={() => setConfirmOpen(false)}
      >
        <Button
          variant="secondary"
          onClick={() => setConfirmOpen(false)}
          disabled={isSubmitting}
        >
          취소
        </Button>
        <Button onClick={handleSubmit} loading={isSubmitting} loadingText="제출 중">
          제출하기
        </Button>
      </Modal>
    </form>
  );
}
