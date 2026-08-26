"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";

export default function MemberAccountDeletionView({
  settingsHref,
}: {
  settingsHref: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeConfirmation = () => {
    if (!deleting) {
      setConfirmationOpen(false);
    }
  };

  const deleteAccount = async () => {
    if (deleting) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/mm/delete", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        notify("회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      notify("회원 탈퇴가 처리되었습니다.");
      router.replace("/");
    } catch {
      notify("회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="회원 탈퇴"
        description="탈퇴 전에 계정과 혜택 이용에 미치는 영향을 확인해 주세요."
        backHref={settingsHref}
        backLabel="설정으로 돌아가기"
        className="border-b-0"
      />

      <Surface level="elevated" padding="lg" className="space-y-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-danger/15 bg-danger/10 text-danger"
          >
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              탈퇴하면 혜택 이용을 계속할 수 없어요
            </h2>
          </div>
        </div>

        <ul className="space-y-3 rounded-[1.25rem] border border-border bg-surface-inset px-4 py-4 text-sm leading-6 text-muted-foreground">
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-lg leading-6 text-foreground">
              ·
            </span>
            <span>제휴 혜택 이용이 즉시 중지됩니다.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-lg leading-6 text-foreground">
              ·
            </span>
            <span>탈퇴 후 다시 이용하려면 가입 절차를 새로 진행해야 합니다.</span>
          </li>
        </ul>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => setConfirmationOpen(true)}
        >
          회원 탈퇴 계속하기
        </Button>
      </Surface>

      <Modal
        open={confirmationOpen}
        title="정말 탈퇴하시겠습니까?"
        description="탈퇴 후에는 로그인과 회원 전용 혜택 이용이 중지됩니다."
        onClose={closeConfirmation}
        bodyClassName="space-y-4"
      >
        <p className="ui-body text-ko-pretty">
          개인 식별 정보와 프로필 사진은 30일 후 익명화됩니다. 계속하려면 아래 탈퇴 버튼을 선택해 주세요.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={deleting} onClick={closeConfirmation}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => void deleteAccount()}
            loading={deleting}
            loadingText="탈퇴 처리 중"
          >
            회원 탈퇴
          </Button>
        </div>
      </Modal>
    </div>
  );
}
