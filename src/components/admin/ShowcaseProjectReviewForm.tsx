"use client";

import Textarea from "@/components/ui/Textarea";

import Input from "@/components/ui/Input";

import { useRef, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { reviewShowcaseProject, updateShowcaseImmediateFeedback } from "@/app/admin/(protected)/events/project-showcase/actions";
import type { ShowcaseProjectStatus, ShowcaseReviewStatus } from "@/lib/project-showcase/types";
import { parseShowcaseReview, SHOWCASE_DUPLICATE_PROJECT_REASON, SHOWCASE_PROJECT_LIMITS } from "@/lib/project-showcase/validation";

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
  allowImmediateFeedback,
}: {
  projectId: string;
  currentStatus: ShowcaseProjectStatus;
  currentNote: string | null;
  allowImmediateFeedback: boolean;
}) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const [immediateAllowed, setImmediateAllowed] = useState(allowImmediateFeedback);
  const [savedImmediateAllowed, setSavedImmediateAllowed] = useState(allowImmediateFeedback);
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

  function saveImmediateFeedbackPolicy() {
    setMessage("");
    setError("");
    const nextAllowed = immediateAllowed;
    startTransition(async () => {
      const result = await updateShowcaseImmediateFeedback(projectId, nextAllowed);
      if (result.ok) {
        setSavedImmediateAllowed(nextAllowed);
        setMessage(result.message);
        return;
      }
      setError(result.message);
    });
  }

  return (
    <div className="grid gap-3">
      <section className="grid gap-3 rounded-xl border border-border bg-surface-muted/60 p-4" aria-label="즉시 피드백 정책">
        <div>
          <p className="text-sm font-semibold text-foreground">체험 피드백 시점</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            외부 페이지의 실제 다운로드·실행 여부는 확인하지 않아요. 링크를 연 시점을 체험으로 기록하고 피드백 가능 시점을 정해요.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm font-medium text-foreground">
          <Input
            type="checkbox"
            checked={immediateAllowed}
            onChange={(event) => setImmediateAllowed(event.currentTarget.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>링크 클릭 기록 후 바로 피드백 허용</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" disabled={isPending || immediateAllowed === savedImmediateAllowed} onClick={saveImmediateFeedbackPolicy}>
            {isPending ? "저장 중…" : "체험 정책 저장"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {immediateAllowed ? "체험 시작 직후 피드백 가능" : "체험 시작 1분 뒤 피드백 가능"}
          </span>
        </div>
      </section>
      <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={`showcase-review-note-${projectId}`}>
        검수 사유 <span className="text-xs font-normal text-muted-foreground">출품자에게 보여요 · 수정 요청과 반려는 필수</span>
        <Textarea
          ref={noteRef}
          id={`showcase-review-note-${projectId}`}
          maxLength={SHOWCASE_PROJECT_LIMITS.reviewNoteMax}
          rows={2}
          defaultValue={currentNote ?? ""}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          placeholder="수정이 필요한 부분이나 판단 근거를 적어 주세요."
        />
      </label>
      <div>
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => {
          if (noteRef.current) { noteRef.current.value = SHOWCASE_DUPLICATE_PROJECT_REASON; noteRef.current.focus(); }
        }}>중복 출품 사유 넣기</Button>
      </div>
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
