"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuggestForm() {
  const [formState, setFormState] = useState(initialState);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
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
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!emailRegex.test(formState.contactEmail)) {
          setErrorMessage("이메일 형식을 확인해 주세요.");
          return;
        }
        if (formState.companyUrl.trim() && !sanitizeHttpUrl(formState.companyUrl)) {
          setErrorMessage("회사 사이트 URL 형식을 확인해 주세요.");
          return;
        }
        if (event.currentTarget.reportValidity()) {
          setConfirmOpen(true);
        }
      }}
    >
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
      <InlineMessage
        title="제안 접수 안내"
        description="업체 정보와 담당자 연락처를 함께 보내 주시면 검토 속도가 빨라집니다."
      />
      <div className="grid gap-1">
        <span className="ui-caption">업체명</span>
        <Input
          name="companyName"
          value={formState.companyName}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid gap-1">
        <span className="ui-caption">업체분야 소개</span>
        <Textarea
          name="businessArea"
          value={formState.businessArea}
          onChange={handleChange}
          rows={3}
          required
        />
      </div>

      <div className="grid gap-1">
        <span className="ui-caption">제안 제휴 조건</span>
        <Textarea
          name="partnershipConditions"
          value={formState.partnershipConditions}
          onChange={handleChange}
          rows={3}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="ui-caption">담당자 이름</span>
          <Input
            name="contactName"
            value={formState.contactName}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-1">
          <span className="ui-caption">담당자 직위</span>
          <Input
            name="contactRole"
            value={formState.contactRole}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="ui-caption">담당자 이메일</span>
          <Input
            type="email"
            name="contactEmail"
            value={formState.contactEmail}
            onChange={handleChange}
            required
            placeholder="example@domain.com"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-1">
          <span className="ui-caption">회사 사이트 URL</span>
          <Input
            name="companyUrl"
            value={formState.companyUrl}
            onChange={handleChange}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
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
        <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
          취소
        </Button>
        <Button onClick={handleSubmit} loading={isSubmitting} loadingText="제출 중">
          제출하기
        </Button>
      </Modal>
    </form>
  );
}
