"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { updateShowcaseSchedule } from "@/app/admin/(protected)/events/project-showcase/actions";
import type { ShowcaseEvent } from "@/lib/project-showcase/types";
import { parseShowcaseSchedule } from "@/lib/project-showcase/validation";

const INPUT_CLASS = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}`;
}

const PERIODS = [
  { title: "모집", start: "submissionStartAt", end: "submissionEndAt" },
  { title: "체험·피드백", start: "experienceStartAt", end: "experienceEndAt" },
  { title: "결과 발표", start: "announcementStartAt", end: "announcementEndAt" },
] as const;

export default function ShowcaseEventSettingsForm({ event }: { event: ShowcaseEvent }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function focusField(field: string | null) {
    if (!field) return;
    formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  }

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setMessage("");
    setError("");
    const formData = new FormData(submitEvent.currentTarget);
    const values = Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
    const parsed = parseShowcaseSchedule(values);
    if (!parsed.success) {
      setError(parsed.message);
      focusField(parsed.field);
      return;
    }
    startTransition(async () => {
      const result = await updateShowcaseSchedule(formData);
      if (result.ok) {
        setMessage(result.message);
        return;
      }
      setError(result.message);
      focusField(result.field);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-4">
        {PERIODS.map((period) => (
          <fieldset key={period.title} className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-foreground">{period.title} <span className="text-xs font-normal text-muted-foreground">한국 시간</span></legend>
            {[period.start, period.end].map((name) => (
              <label key={name} className="grid gap-1.5 text-xs font-medium text-muted-foreground" htmlFor={`showcase-${name}`}>
                {name === period.start ? "시작" : name === "announcementEndAt" ? "종료 (선택)" : "종료"}
                <input id={`showcase-${name}`} type="datetime-local" name={name} defaultValue={toDateTimeLocal(event[name])} className={INPUT_CLASS} />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor="showcase-submitter-count">
          출품 경품 수량 (프로젝트)
          <input id="showcase-submitter-count" name="submitterSelectionCount" type="number" inputMode="numeric" min={0} max={500} defaultValue={event.submitterSelectionCount} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor="showcase-experiencer-count">
          체험 경품 수량 (명)
          <input id="showcase-experiencer-count" name="experiencerSelectionCount" type="number" inputMode="numeric" min={0} max={500} defaultValue={event.experiencerSelectionCount} className={INPUT_CLASS} />
        </label>
      </div>
      <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
        <input type="checkbox" name="isActive" value="true" defaultChecked={event.isActive} className="mt-1 h-4 w-4 accent-primary" />
        <span>이벤트 활성화 · 끄면 날짜와 관계없이 출품과 체험이 모두 중단돼요.</span>
      </label>
      <div className="grid gap-3">
        <p className="text-xs leading-5 text-muted-foreground">모집 → 체험 → 발표 순서로 겹치지 않게 설정해 주세요. 체험 종료와 발표 시작 사이가 검증·추첨 기간이에요.</p>
        {error ? <FormMessage variant="error">{error}</FormMessage> : null}
        {message ? <FormMessage variant="info">{message}</FormMessage> : null}
        <div><Button type="submit" disabled={isPending}>{isPending ? "저장 중…" : "일정 저장"}</Button></div>
      </div>
    </form>
  );
}
