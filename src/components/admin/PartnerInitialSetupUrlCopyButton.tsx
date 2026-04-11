"use client";

import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function PartnerInitialSetupUrlCopyButton({
  setupUrl,
}: {
  setupUrl: string;
}) {
  const { notify } = useToast();

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full sm:w-auto"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(setupUrl);
          notify("초기설정 URL이 복사되었습니다.");
        } catch {
          notify("복사에 실패했습니다.");
        }
      }}
      ariaLabel="초기설정 URL 복사"
      title="초기설정 URL 복사"
    >
      초기설정 URL 복사
    </Button>
  );
}
