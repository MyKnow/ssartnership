"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormMessage from "@/components/ui/FormMessage";
import { deleteAdminShowcaseProject } from "@/app/admin/(protected)/events/project-showcase/actions";

export default function ShowcaseAdminProjectDeleteButton({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  function removeProject() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await deleteAdminShowcaseProject(projectId);
      setConfirmOpen(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid justify-items-start gap-2">
      <Button type="button" variant="danger" disabled={pending} onClick={() => setConfirmOpen(true)}>
        {pending ? "삭제 중…" : "출품작 완전 삭제"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={`“${projectTitle}” 출품작을 완전히 삭제할까요?`}
        description="연결된 조회·체험·피드백·관심 기록도 함께 삭제됩니다. 추첨·당첨 스냅샷과 관리자 로그는 보존됩니다. 삭제 후에는 복구할 수 없습니다."
        confirmLabel="출품작 완전 삭제"
        pendingLabel="삭제 중"
        pending={pending}
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={removeProject}
      />
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
    </div>
  );
}
