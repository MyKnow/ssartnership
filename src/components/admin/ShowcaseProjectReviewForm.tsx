"use client";

import { useRef, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { reviewShowcaseProject } from "@/app/admin/(protected)/events/project-showcase/actions";
import type { ShowcaseProjectStatus, ShowcaseReviewStatus } from "@/lib/project-showcase/types";
import { parseShowcaseReview } from "@/lib/project-showcase/validation";

const ACTIONS: Array<{ status: ShowcaseReviewStatus; label: string; variant: "primary" | "secondary" | "danger" }> = [
  { status: "approved", label: "승인", variant: "primary" },
  { status: "changes_requested", label: "수정 요청", variant: "secondary" },
  { status: "rejected", label: "반려", variant: "danger" },
  { status: "hidden", label: "숨김", variant: "secondary" },
];

export default function ShowcaseProjectReviewForm({
  projectId,
  currentStatus,
  currentNote,
}: {
  projectId: string;
  currentStatus: ShowcaseProjectStatus;
  currentNote: string | null;
}) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const actions = ACTIONS.filter((action) => action.status !== currentStatus);

  function submit(status: ShowcaseReviewStatus) {
    setMessage("");
    setError("");
    const reviewNote = noteRef.current?.value ?? "";
    const parsed = parseShowcaseReview({ status, reviewNote });
    if (!parsed.success) {
      setError(parsed.message);
      if (parsed.field === "reviewNote") noteRef.current?.focus();
      return;
    }
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("status", status);
    formData.set("reviewNote", reviewNote);
    startTransition(async () => {
      const result = await reviewShowcaseProject(formData);
      if (result.ok) {
        setMessage(result.message);
        return;
      }
      setError(result.message);
      if (result.field === "reviewNote") noteRef.current?.focus();
    });
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={`showcase-review-note-${projectId}`}>
        검수 사유 <span className="text-xs font-normal text-muted-foreground">출품자에게 보여요 · 수정 요청과 반려는 필수</span>
        <textarea
          ref={noteRef}
          id={`showcase-review-note-${projectId}`}
          maxLength={2000}
          rows={2}
          defaultValue={currentNote ?? ""}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          placeholder="수정이 필요한 부분이나 판단 근거를 적어 주세요."
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.status} type="button" variant={action.variant} disabled={isPending} onClick={() => submit(action.status)}>
            {action.label}
          </Button>
        ))}
      </div>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
    </div>
  );
}
