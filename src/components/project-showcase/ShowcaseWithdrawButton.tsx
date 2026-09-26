"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { withdrawShowcaseProject } from "@/app/(site)/events/project-showcase/actions";

export default function ShowcaseWithdrawButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function withdraw() {
    setError("");
    startTransition(async () => {
      const result = await withdrawShowcaseProject(projectId);
      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }
      router.push("/events/project-showcase/my");
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div className="grid gap-2">
        <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>출품 취소</Button>
        {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4" role="alertdialog" aria-labelledby="showcase-withdraw-title">
      <p id="showcase-withdraw-title" className="text-sm font-semibold text-foreground">출품을 취소할까요?</p>
      <p className="text-sm leading-6 text-muted-foreground">이 프로젝트가 출품 목록과 추첨 대상에서 제외돼요. 다른 출품작은 그대로 유지돼요.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="danger" onClick={withdraw} disabled={isPending}>{isPending ? "취소 중…" : "출품 취소하기"}</Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={isPending}>돌아가기</Button>
      </div>
    </div>
  );
}
