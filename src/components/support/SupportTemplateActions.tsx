"use client";

import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function SupportTemplateActions({
  copyText,
  mailtoHref,
}: {
  copyText: string;
  mailtoHref: string;
}) {
  const { notify } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      notify("문의 템플릿을 복사했습니다.");
    } catch {
      notify("복사에 실패했습니다.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={handleCopy}>
        템플릿 복사
      </Button>
      <Button variant="secondary" href={mailtoHref}>
        메일 앱 열기
      </Button>
    </div>
  );
}
