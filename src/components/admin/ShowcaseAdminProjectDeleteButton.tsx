"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
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

  function removeProject() {
    const confirmed = window.confirm(
      `“${projectTitle}” 출품작을 완전히 삭제할까요?\n\n연결된 조회·체험·피드백·관심 기록도 함께 삭제됩니다. 추첨·당첨 스냅샷과 관리자 로그는 보존됩니다. 삭제 후에는 복구할 수 없습니다.`,
    );
    if (!confirmed) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await deleteAdminShowcaseProject(projectId);
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
      <Button type="button" variant="danger" disabled={pending} onClick={removeProject}>
        {pending ? "삭제 중…" : "출품작 완전 삭제"}
      </Button>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
    </div>
  );
}
