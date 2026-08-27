"use client";

import { useId, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import GraduatePasswordResetForm from "@/components/auth/GraduatePasswordResetForm";
import MattermostCodeVerificationForm from "@/components/auth/MattermostCodeVerificationForm";

type ResetMethod = "mattermost" | "graduate_email";

const resetMethods: ResetMethod[] = ["mattermost", "graduate_email"];

function resetMethodTabClassName(active: boolean) {
  const base =
    "min-h-11 rounded-[0.95rem] px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
  return active
    ? `${base} bg-primary text-primary-foreground shadow-raised`
    : `${base} text-foreground hover:bg-surface-control`;
}

export default function PasswordResetMethodTabs({
  activeSenderGenerations = [],
  configuredSenderGenerations = [],
}: {
  activeSenderGenerations?: readonly number[];
  configuredSenderGenerations?: readonly number[];
}) {
  const [method, setMethod] = useState<ResetMethod>("mattermost");
  const id = useId();
  const memberTabId = `${id}-member-tab`;
  const graduateTabId = `${id}-graduate-tab`;
  const memberPanelId = `${id}-member-panel`;
  const graduatePanelId = `${id}-graduate-panel`;

  function selectMethod(nextMethod: ResetMethod) {
    setMethod(nextMethod);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentMethod: ResetMethod,
  ) {
    const currentIndex = resetMethods.indexOf(currentMethod);
    const nextIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % resetMethods.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + resetMethods.length) % resetMethods.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? resetMethods.length - 1
              : null;

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextMethod = resetMethods[nextIndex];
    selectMethod(nextMethod);
    document
      .getElementById(nextMethod === "mattermost" ? memberTabId : graduateTabId)
      ?.focus();
  }

  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="비밀번호 재설정 유형"
        className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-border bg-surface-inset p-2"
      >
        <button
          id={memberTabId}
          type="button"
          role="tab"
          aria-selected={method === "mattermost"}
          aria-controls={memberPanelId}
          tabIndex={method === "mattermost" ? 0 : -1}
          onClick={() => selectMethod("mattermost")}
          onKeyDown={(event) => handleTabKeyDown(event, "mattermost")}
          className={resetMethodTabClassName(method === "mattermost")}
        >
          운영진·재학생
        </button>
        <button
          id={graduateTabId}
          type="button"
          role="tab"
          aria-selected={method === "graduate_email"}
          aria-controls={graduatePanelId}
          tabIndex={method === "graduate_email" ? 0 : -1}
          onClick={() => selectMethod("graduate_email")}
          onKeyDown={(event) => handleTabKeyDown(event, "graduate_email")}
          className={resetMethodTabClassName(method === "graduate_email")}
        >
          수료생
        </button>
      </div>
      {method === "mattermost" ? (
        <section id={memberPanelId} role="tabpanel" aria-labelledby={memberTabId}>
          <p className="mt-5 text-sm text-muted-foreground">
            가입 때 연결한 Mattermost 계정으로 인증 코드를 받으면 새 비밀번호를 설정할 수 있습니다.
          </p>
          <MattermostCodeVerificationForm
            purpose="reset_password"
            activeSenderGenerations={activeSenderGenerations}
            configuredSenderGenerations={configuredSenderGenerations}
          />
        </section>
      ) : (
        <section id={graduatePanelId} role="tabpanel" aria-labelledby={graduateTabId}>
          <GraduatePasswordResetForm />
        </section>
      )}
      <div className="mt-5 grid gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <Link
          href="/auth/login?returnTo=%2Fcertification%2Femail"
          className="font-medium underline underline-offset-4 hover:text-foreground"
        >
          기존 사이트 비밀번호를 알고 있나요? 로그인 후 이메일 등록
        </Link>
        <Link href="/auth/signup/graduate?kind=recovery" className="font-medium underline underline-offset-4 hover:text-foreground">
          기존 사이트 비밀번호도 모르면 기존 회원 복구 신청
        </Link>
      </div>
    </div>
  );
}
