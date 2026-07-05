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
  const [statusMessage, setStatusMessage] = useState(
    "템플릿을 복사하거나 메일 앱을 열어 문의를 보낼 수 있습니다.",
  );

  const handleCopy = async () => {
    if (copyPending) {
      return;
    }
    setCopyPending(true);
    setStatusMessage("문의 템플릿을 복사하는 중입니다.");
    try {
      await navigator.clipboard.writeText(copyText);
      setStatusMessage("문의 템플릿을 복사했습니다.");
      notify("문의 템플릿을 복사했습니다.");
    } catch {
      setStatusMessage("복사에 실패했습니다. 본문을 직접 선택해 복사해 주세요.");
      notify("복사에 실패했습니다.");
    } finally {
      setCopyPending(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            setStatusMessage("메일 앱 열기를 시도했습니다.");
            notify("메일 앱을 열었습니다.");
          }}
        >
          <Mail className="h-4 w-4" />
          메일 앱 열기
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-ko-pretty text-xs leading-5 text-muted-foreground"
      >
        {statusMessage}
      </p>
    </div>
  );
}
