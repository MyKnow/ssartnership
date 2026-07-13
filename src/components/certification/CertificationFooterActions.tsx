"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";

export default function CertificationFooterActions({
  canChangeProfilePhoto = false,
}: {
  canChangeProfilePhoto?: boolean;
}) {
  const { notify } = useToast();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  return (
    <Surface
      level="inset"
      padding="lg"
      className="flex w-full flex-wrap items-center gap-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">계정 관리</p>
        <p className="mt-1 text-xs text-muted-foreground">
          비밀번호 변경 또는 회원 탈퇴를 진행할 수 있습니다. 탈퇴 후 30일이 지나면 개인 식별 정보와 프로필 사진이 익명화됩니다.
        </p>
      </div>
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        {canChangeProfilePhoto ? (
          <Button
            variant="ghost"
            href="/certification/photo"
            prefetch={false}
          >
            본인 사진 변경
          </Button>
        ) : null}
        <Button
          variant="ghost"
          href="/auth/change-password?returnTo=%2Fcertification"
          prefetch={false}
        >
          비밀번호 변경하기
        </Button>
        <Button
          variant="danger"
          loading={deleting}
          loadingText="회원 탈퇴 중"
          onClick={async () => {
            if (deleting) {
              return;
            }
            const first = window.confirm(
              "정말 탈퇴하시겠습니까? 탈퇴 후에는 로그인과 혜택 이용이 중지됩니다.",
            );
            if (!first) {
              return;
            }
            const second = window.confirm(
              "한 번 더 확인합니다. 30일 후 개인 식별 정보와 프로필 사진이 익명화됩니다.",
            );
            if (!second) {
              return;
            }
            setDeleting(true);
            try {
              const response = await fetch("/api/mm/delete", { method: "POST" });
              if (response.ok) {
                notify("회원 탈퇴가 처리되었습니다.");
                router.replace("/");
                return;
              }
              notify("회원 탈퇴에 실패했습니다.");
            } finally {
              setDeleting(false);
            }
          }}
        >
          회원 탈퇴
        </Button>
      </div>
    </Surface>
  );
}
