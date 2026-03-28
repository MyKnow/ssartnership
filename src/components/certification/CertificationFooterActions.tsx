"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function CertificationFooterActions() {
  const { notify } = useToast();
  const router = useRouter();

  return (
    <div className="mx-auto mt-4 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">계정 관리</p>
        <p className="mt-1 text-xs text-muted-foreground">
          비밀번호 변경 또는 회원 탈퇴를 진행할 수 있습니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" href="/auth/change-password">
          비밀번호 변경하기
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            const first = window.confirm(
              "정말 탈퇴하시겠습니까? 저장된 인증 정보가 삭제됩니다.",
            );
            if (!first) {
              return;
            }
            const second = window.confirm(
              "한 번 더 확인합니다. 탈퇴하면 되돌릴 수 없습니다.",
            );
            if (!second) {
              return;
            }
            const response = await fetch("/api/mm/delete", { method: "POST" });
            if (response.ok) {
              notify("회원 탈퇴가 완료되었습니다.");
              router.replace("/");
              router.refresh();
              return;
            }
            notify("회원 탈퇴에 실패했습니다.");
          }}
        >
          회원 탈퇴
        </Button>
      </div>
    </div>
  );
}
