"use client";

import { useId, useState } from "react";
import Link from "next/link";
import GraduatePasswordResetForm from "@/components/auth/GraduatePasswordResetForm";
import ManualMemberEmailResetForm from "@/components/member-manual-import/ManualMemberEmailResetForm";
import MattermostCodeVerificationForm from "@/components/auth/MattermostCodeVerificationForm";

type ResetMethod = "mattermost" | "manual_email" | "graduate_email";

export default function PasswordResetMethodTabs({
  activeSenderGenerations = [],
}: {
  activeSenderGenerations?: readonly number[];
}) {
  const [method, setMethod] = useState<ResetMethod>("mattermost");
  const id = useId();
  const memberTabId = `${id}-member-tab`;
  const graduateTabId = `${id}-graduate-tab`;
  const memberPanelId = `${id}-member-panel`;
  const graduatePanelId = `${id}-graduate-panel`;
  const manualTabId = `${id}-manual-tab`;
  const manualPanelId = `${id}-manual-panel`;

  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="비밀번호 재설정 유형"
        className="grid grid-cols-3 gap-2 rounded-[1.35rem] border border-border bg-surface-inset p-2"
      >
        <button
          id={memberTabId}
          type="button"
          role="tab"
          aria-selected={method === "mattermost"}
          aria-controls={memberPanelId}
          onClick={() => setMethod("mattermost")}
          className={method === "mattermost"
            ? "min-h-11 rounded-[0.95rem] bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-raised"
            : "min-h-11 rounded-[0.95rem] px-3 text-sm font-semibold text-foreground hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"}
        >
          운영진·재학생
        </button>
        <button id={manualTabId} type="button" role="tab" aria-selected={method === "manual_email"} aria-controls={manualPanelId} onClick={() => setMethod("manual_email")} className={method === "manual_email" ? "min-h-11 rounded-[0.95rem] bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-raised" : "min-h-11 rounded-[0.95rem] px-3 text-sm font-semibold text-foreground hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"}>이메일 초대</button>
        <button
          id={graduateTabId}
          type="button"
          role="tab"
          aria-selected={method === "graduate_email"}
          aria-controls={graduatePanelId}
          onClick={() => setMethod("graduate_email")}
          className={method === "graduate_email"
            ? "min-h-11 rounded-[0.95rem] bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-raised"
            : "min-h-11 rounded-[0.95rem] px-3 text-sm font-semibold text-foreground hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"}
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
          />
        </section>
      ) : method === "manual_email" ? (
        <section id={manualPanelId} role="tabpanel" aria-labelledby={manualTabId}><ManualMemberEmailResetForm /></section>
      ) : (
        <section id={graduatePanelId} role="tabpanel" aria-labelledby={graduateTabId}>
          <GraduatePasswordResetForm />
        </section>
      )}
      <div className="mt-5 grid gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <Link href="/auth/recover-email" className="font-medium underline underline-offset-4 hover:text-foreground">
          Mattermost를 사용할 수 없지만 기존 사이트 비밀번호는 알고 있나요? 이메일 로그인 복구
        </Link>
        <Link href="/auth/signup/graduate?kind=recovery" className="font-medium underline underline-offset-4 hover:text-foreground">
          기존 사이트 비밀번호도 모르면 기존 회원 복구 신청
        </Link>
      </div>
    </div>
  );
}
