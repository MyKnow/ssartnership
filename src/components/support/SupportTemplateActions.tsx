"use client";

import { useState } from "react";
import { Clipboard, Mail } from "lucide-react";
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
  const [copyPending, setCopyPending] = useState(false);

  const handleCopy = async () => {
    if (copyPending) {
      return;
    }
    setCopyPending(true);
    try {
      await navigator.clipboard.writeText(copyText);
      notify("문의 템플릿을 복사했습니다.");
    } catch {
      notify("복사에 실패했습니다.");
    } finally {
      setCopyPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Button
        type="button"
        onClick={handleCopy}
        loading={copyPending}
        loadingText="복사 중"
        className="w-full sm:w-auto"
      >
        <Clipboard className="h-4 w-4" />
        템플릿 복사
      </Button>
      <Button
        variant="secondary"
        href={mailtoHref}
        className="w-full sm:w-auto"
        onClick={() => {
          notify("메일 앱을 열었습니다.");
        }}
      >
        <Mail className="h-4 w-4" />
        메일 앱 열기
      </Button>
    </div>
  );
}
