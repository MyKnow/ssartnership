"use client";

import { useId, useState } from "react";
import GraduatePasswordResetForm from "@/components/auth/GraduatePasswordResetForm";
import ManualMemberEmailResetForm from "@/components/member-manual-import/ManualMemberEmailResetForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

type ResetMethod = "ssafy_verify" | "manual_email" | "graduate_email";

export default function PasswordResetMethodTabs() {
  const [method, setMethod] = useState<ResetMethod>("ssafy_verify");
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
          aria-selected={method === "ssafy_verify"}
          aria-controls={memberPanelId}
          onClick={() => setMethod("ssafy_verify")}
          className={method === "ssafy_verify"
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
      {method === "ssafy_verify" ? (
        <section id={memberPanelId} role="tabpanel" aria-labelledby={memberTabId}>
          <p className="mt-5 text-sm text-muted-foreground">
            SSAFY Verify 인증을 완료하면 새 비밀번호 설정 페이지로 이동합니다.
          </p>
          <ResetPasswordForm />
        </section>
      ) : method === "manual_email" ? (
        <section id={manualPanelId} role="tabpanel" aria-labelledby={manualTabId}><ManualMemberEmailResetForm /></section>
      ) : (
        <section id={graduatePanelId} role="tabpanel" aria-labelledby={graduateTabId}>
          <GraduatePasswordResetForm />
        </section>
      )}
    </div>
  );
}
