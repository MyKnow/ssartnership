"use client";

import { useRef, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import {
  excludeShowcaseCandidate,
  redrawShowcaseWinner,
  restoreShowcaseCandidate,
  runShowcaseDraw,
  setShowcaseWinnerDelivered,
  settleShowcaseEvent,
  voidShowcaseWinner,
} from "@/app/admin/(protected)/events/project-showcase/actions";
import {
  SHOWCASE_VOID_REASONS,
  type ShowcaseAdminWinner,
  type ShowcaseCandidateGroup,
  type ShowcaseVoidReason,
} from "@/lib/project-showcase/types";
import { parseShowcaseExclusionReason } from "@/lib/project-showcase/validation";

type ActionResult = { ok: boolean; message: string };

function useActionFeedback() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function run(action: () => Promise<ActionResult>) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    });
  }
  const feedback = (
    <>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {message ? <p className="text-xs text-muted-foreground" role="status">{message}</p> : null}
    </>
  );
  return { isPending, run, feedback, setError };
}

export function ShowcaseCandidateExclusionControl({
  group,
  targetId,
  exclusion,
  disabled,
}: {
  group: ShowcaseCandidateGroup;
  targetId: string;
  exclusion: { id: string; reason: string } | null;
  disabled: boolean;
}) {
  const reasonRef = useRef<HTMLInputElement>(null);
  const { isPending, run, feedback, setError } = useActionFeedback();

  if (exclusion) {
    return (
      <div className="grid justify-items-start gap-1.5">
        <p className="text-xs text-muted-foreground">제외 사유: {exclusion.reason}</p>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || isPending} onClick={() => run(() => restoreShowcaseCandidate(exclusion.id))}>
          후보로 복구
        </Button>
        {feedback}
      </div>
    );
  }

  return (
    <form
      className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto]"
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const parsed = parseShowcaseExclusionReason(reasonRef.current?.value ?? "");
        if (!parsed.success) {
          setError(parsed.message);
          reasonRef.current?.focus();
          return;
        }
        run(() => excludeShowcaseCandidate({ group, targetId, reason: parsed.data.reason }));
      }}
    >
      <label className="sr-only" htmlFor={`showcase-exclude-${targetId}`}>제외 사유</label>
      <input
        ref={reasonRef}
        id={`showcase-exclude-${targetId}`}
        maxLength={500}
        disabled={disabled}
        placeholder="제외 사유 (외부인, 중복 계정, 허위 기록 등)"
        className="min-h-9 min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={disabled || isPending}>제외</Button>
      <div className="sm:col-span-2">{feedback}</div>
    </form>
  );
}

export function ShowcaseDrawButton({
  group,
  label,
  disabledReason,
}: {
  group: ShowcaseCandidateGroup;
  label: string;
  disabledReason: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const { isPending, run, feedback } = useActionFeedback();
  return (
    <div className="grid justify-items-start gap-2">
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPending} onClick={() => { setConfirming(false); run(() => runShowcaseDraw(group)); }}>
            {isPending ? "추첨 중…" : "이대로 추첨하기"}
          </Button>
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirming(false)}>취소</Button>
        </div>
      ) : (
        <Button type="button" disabled={Boolean(disabledReason) || isPending} onClick={() => setConfirming(true)}>{label}</Button>
      )}
      {disabledReason ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null}
      {confirming ? <p className="text-xs text-muted-foreground">추첨은 분야마다 한 번만 실행돼요. 제외할 후보를 먼저 확인해 주세요.</p> : null}
      {feedback}
    </div>
  );
}

const VOID_REASON_LABELS: Record<ShowcaseVoidReason, string> = {
  duplicate: "중복 당첨",
  unreachable: "경품 수령 불가 (연락 불가 등)",
  verification_failed: "검증 실패",
};

export function ShowcaseWinnerControls({ winner, disabled }: { winner: ShowcaseAdminWinner; disabled: boolean }) {
  const reasonRef = useRef<HTMLSelectElement>(null);
  const [delivered, setDelivered] = useState(Boolean(winner.deliveredAt));
  const { isPending, run, feedback } = useActionFeedback();

  if (winner.status === "voided") {
    return (
      <div className="grid justify-items-start gap-1.5">
        <p className="text-xs text-muted-foreground">무효 · {winner.voidReason ? VOID_REASON_LABELS[winner.voidReason] : "사유 없음"}</p>
        {winner.replaced ? (
          <p className="text-xs text-muted-foreground">재추첨 완료</p>
        ) : (
          <Button type="button" size="sm" disabled={disabled || isPending} onClick={() => run(() => redrawShowcaseWinner(winner.id))}>
            {isPending ? "재추첨 중…" : "1명 재추첨"}
          </Button>
        )}
        {feedback}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={delivered}
          disabled={disabled || isPending}
          onChange={(changeEvent) => {
            const next = changeEvent.target.checked;
            setDelivered(next);
            run(async () => {
              const result = await setShowcaseWinnerDelivered(winner.id, next);
              if (!result.ok) setDelivered(!next);
              return result;
            });
          }}
          className="h-4 w-4 accent-primary"
        />
        Mattermost 발송 완료
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`showcase-void-${winner.id}`}>무효 사유</label>
        <select
          ref={reasonRef}
          id={`showcase-void-${winner.id}`}
          disabled={disabled}
          defaultValue="unreachable"
          className="min-h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground disabled:opacity-60"
        >
          {SHOWCASE_VOID_REASONS.map((reason) => <option key={reason} value={reason}>{VOID_REASON_LABELS[reason]}</option>)}
        </select>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={disabled || isPending}
          onClick={() => run(() => voidShowcaseWinner(winner.id, (reasonRef.current?.value ?? "unreachable") as ShowcaseVoidReason))}
        >
          무효 처리
        </Button>
      </div>
      {feedback}
    </div>
  );
}

export function ShowcaseAnnouncementCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <label className="sr-only" htmlFor="showcase-announcement-text">Mattermost 공지 문구</label>
      <textarea
        id="showcase-announcement-text"
        readOnly
        value={text}
        rows={Math.min(18, text.split("\n").length + 1)}
        className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 font-mono text-xs leading-5 text-foreground"
      />
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "복사했어요" : "공지 문구 복사"}
        </Button>
      </div>
    </div>
  );
}

export function ShowcaseSettleButton({ disabledReason }: { disabledReason: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const { isPending, run, feedback } = useActionFeedback();
  return (
    <div className="grid justify-items-start gap-2">
      {confirming ? (
        <div className="grid gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm text-foreground">정산 완료 뒤에는 추첨·무효·발송 기록을 바꿀 수 없고, 30일 뒤 학번과 체험 기록의 회원 연결이 파기돼요.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" disabled={isPending} onClick={() => { setConfirming(false); run(settleShowcaseEvent); }}>
              {isPending ? "기록 중…" : "정산 완료로 기록"}
            </Button>
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirming(false)}>취소</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" disabled={Boolean(disabledReason) || isPending} onClick={() => setConfirming(true)}>정산 완료</Button>
      )}
      {disabledReason ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null}
      {feedback}
    </div>
  );
}
