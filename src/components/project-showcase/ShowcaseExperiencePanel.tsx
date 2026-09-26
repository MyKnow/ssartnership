"use client";

import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import {
  registerShowcaseParticipant,
  setShowcaseInterest,
  startShowcaseExperience,
  submitShowcaseFeedback,
} from "@/app/(site)/events/project-showcase/actions";
import {
  getShowcaseFeedbackUnlockAt,
  type ShowcaseMemberProjectState,
} from "@/lib/project-showcase/types";
import {
  parseShowcaseFeedback,
  parseShowcaseRegistration,
  SHOWCASE_FEEDBACK_MAX_LENGTH,
} from "@/lib/project-showcase/validation";

const INPUT_CLASS = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary";

type Props = {
  projectId: string;
  serviceUrl: string;
  authenticated: boolean;
  isOwner: boolean;
  loginHref: string;
  initialState: ShowcaseMemberProjectState;
  serverNow: string;
};

/** Opens a tab synchronously (before awaiting the server) so popup blockers allow it. */
function openPendingTab() {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  return tab;
}

export default function ShowcaseExperiencePanel({
  projectId,
  serviceUrl,
  authenticated,
  isOwner,
  loginHref,
  initialState,
  serverNow,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(initialState);
  const serverNowMs = new Date(serverNow).getTime();
  // `now` is expressed on the server clock so SSR and hydration compute the same countdown.
  const [now, setNow] = useState(serverNowMs);
  const clockOffsetRef = useRef(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const studentNumberRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    clockOffsetRef.current = serverNowMs - Date.now();
  }, [serverNowMs]);

  const unlockAt = state.startedAt ? getShowcaseFeedbackUnlockAt(state.startedAt).getTime() : null;
  const remainingSeconds = unlockAt === null ? null : Math.max(0, Math.ceil((unlockAt - now) / 1000));

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds === 0 || state.feedbackSubmitted) return;
    const timer = window.setInterval(() => setNow(Date.now() + clockOffsetRef.current), 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds, state.feedbackSubmitted]);

  function fail(nextMessage: string, focus?: HTMLElement | null) {
    setMessage("");
    setError(nextMessage);
    focus?.focus();
  }

  async function beginExperience(tab: Window | null) {
    const result = await startShowcaseExperience(projectId);
    if (!result.ok) {
      tab?.close();
      fail(result.message);
      return;
    }
    const resultServerNow = new Date(result.serverNow).getTime();
    clockOffsetRef.current = resultServerNow - Date.now();
    setNow(resultServerNow);
    setState((current) => ({ ...current, registered: true, startedAt: result.startedAt }));
    setMessage("체험을 시작했어요. 1분 뒤 이곳에서 한 줄 피드백을 남기면 추첨권 1장을 받아요.");
    if (tab) tab.location.assign(result.destination);
    else window.open(result.destination, "_blank", "noopener,noreferrer");
  }

  function handleRegister(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError("");
    const formData = new FormData(submitEvent.currentTarget);
    const input = {
      studentNumber: String(formData.get("studentNumber") ?? ""),
      studentNumberConsent: formData.get("studentNumberConsent") === "true",
      announcementConsent: formData.get("announcementConsent") === "true",
    };
    const parsed = parseShowcaseRegistration(input);
    if (!parsed.success) {
      const target = parsed.field === "studentNumber"
        ? studentNumberRef.current
        : formRef.current?.querySelector<HTMLElement>(`[name="${parsed.field}"]`);
      fail(parsed.message, target);
      return;
    }
    const tab = openPendingTab();
    startTransition(async () => {
      const result = await registerShowcaseParticipant(input);
      if (!result.ok) {
        tab?.close();
        fail(result.message, result.field === "studentNumber" ? studentNumberRef.current : null);
        return;
      }
      await beginExperience(tab);
      router.refresh();
    });
  }

  function handleStart() {
    setError("");
    const tab = openPendingTab();
    startTransition(() => beginExperience(tab));
  }

  function handleFeedback(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError("");
    const body = feedbackRef.current?.value ?? "";
    const parsed = parseShowcaseFeedback(body);
    if (!parsed.success) {
      fail(parsed.message, feedbackRef.current);
      return;
    }
    startTransition(async () => {
      const result = await submitShowcaseFeedback(projectId, parsed.data.body);
      if (!result.ok) {
        fail(result.message, result.field === "body" ? feedbackRef.current : null);
        return;
      }
      setState((current) => ({ ...current, feedbackSubmitted: true }));
      setMessage(result.message);
      router.refresh();
    });
  }

  function toggleInterest() {
    const next = !state.interested;
    setState((current) => ({ ...current, interested: next }));
    startTransition(async () => {
      const result = await setShowcaseInterest(projectId, next);
      if (!result.ok) {
        setState((current) => ({ ...current, interested: !next }));
        fail(result.message);
      }
    });
  }

  if (!authenticated) {
    return (
      <div className="grid gap-3">
        <Button href={loginHref}>로그인 후 체험하기</Button>
        <p className="text-xs leading-5 text-muted-foreground">SSAFY 구성원 인증을 마친 회원만 체험 기록과 추첨권을 받을 수 있어요.</p>
      </div>
    );
  }

  if (isOwner) {
    return <p className="text-sm leading-6 text-muted-foreground">내 프로젝트는 체험하거나 관심 표시할 수 없어요. 조회·체험 기록은 집계에서 제외돼요.</p>;
  }

  const interestButton = (
    <button
      type="button"
      onClick={toggleInterest}
      disabled={isPending}
      aria-pressed={state.interested}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
    >
      {state.interested
        ? <HeartSolidIcon className="h-5 w-5 text-danger" aria-hidden="true" />
        : <HeartOutlineIcon className="h-5 w-5" aria-hidden="true" />}
      {state.interested ? "관심 있어요" : "관심 표시"}
    </button>
  );

  return (
    <div className="grid gap-4">
      {!state.registered ? (
        <form ref={formRef} onSubmit={handleRegister} className="grid gap-3" noValidate>
          <p className="text-sm font-semibold text-foreground">처음 체험하기 전에 참여 등록을 한 번 해 주세요.</p>
          <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="showcase-register-number">
            내 학번
            <input
              ref={studentNumberRef}
              id="showcase-register-number"
              name="studentNumber"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              placeholder="숫자 7자리"
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex items-start gap-2 text-xs leading-5 text-foreground">
            <input type="checkbox" name="studentNumberConsent" value="true" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
            <span>(필수) 학번을 이벤트 운영과 중복 참여 확인에 사용하는 데 동의해요.</span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-5 text-foreground">
            <input type="checkbox" name="announcementConsent" value="true" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
            <span>(필수) 당첨되면 이름·학번 일부를 가려(예: 정** · 15****43) 공지하는 데 동의해요.</span>
          </label>
          <Button type="submit" disabled={isPending}>{isPending ? "처리 중…" : "참여 등록하고 체험 시작"}</Button>
        </form>
      ) : !state.startedAt ? (
        <Button type="button" onClick={handleStart} disabled={isPending}>{isPending ? "기록 중…" : "체험 시작"}</Button>
      ) : state.feedbackSubmitted ? (
        <div className="grid gap-2 rounded-xl bg-success/10 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">피드백 완료 · 추첨권 1장</p>
          <a href={serviceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline">서비스 다시 열기</a>
        </div>
      ) : (
        <form onSubmit={handleFeedback} className="grid gap-3" noValidate>
          <a href={serviceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline">서비스 다시 열기</a>
          <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="showcase-feedback-body">
            한 줄 피드백
            <textarea
              ref={feedbackRef}
              id="showcase-feedback-body"
              rows={3}
              maxLength={SHOWCASE_FEEDBACK_MAX_LENGTH}
              disabled={remainingSeconds !== 0}
              placeholder="좋았던 점이나 개선하면 좋을 점을 10자 이상 남겨 주세요."
              className={`${INPUT_CLASS} py-2 disabled:opacity-60`}
            />
          </label>
          <Button type="submit" disabled={isPending || remainingSeconds !== 0}>
            {remainingSeconds ? `${remainingSeconds}초 뒤 작성할 수 있어요` : isPending ? "저장 중…" : "피드백 남기고 추첨권 받기"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">피드백은 작성자 정보 없이 출품자에게 전달돼요.</p>
        </form>
      )}
      {interestButton}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {message ? <p className="text-sm leading-6 text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}
