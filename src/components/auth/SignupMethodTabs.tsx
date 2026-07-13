"use client";

import { useId, useState, type KeyboardEvent } from "react";
import SsafyVerifyButton from "@/components/auth/SsafyVerifyButton";
import Button from "@/components/ui/Button";

export type SignupMethod = "member" | "graduate";

const signupMethods: SignupMethod[] = ["member", "graduate"];

function tabClassName(active: boolean) {
  return active
    ? "min-h-11 rounded-[0.95rem] bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-raised sm:text-sm"
    : "min-h-11 rounded-[0.95rem] px-3 text-xs font-semibold text-foreground transition hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:text-sm";
}

export default function SignupMethodTabs({
  returnTo,
  initialMethod = "member",
}: {
  returnTo: string;
  initialMethod?: SignupMethod;
}) {
  const [method, setMethod] = useState<SignupMethod>(initialMethod);
  const id = useId();
  const memberTabId = `${id}-member-tab`;
  const graduateTabId = `${id}-graduate-tab`;
  const memberPanelId = `${id}-member-panel`;
  const graduatePanelId = `${id}-graduate-panel`;
  const graduateHref = `/auth/signup/graduate?returnTo=${encodeURIComponent(returnTo)}`;

  function selectMethod(nextMethod: SignupMethod) {
    setMethod(nextMethod);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentMethod: SignupMethod) {
    const currentIndex = signupMethods.indexOf(currentMethod);
    const nextIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % signupMethods.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + signupMethods.length) % signupMethods.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? signupMethods.length - 1
              : null;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextMethod = signupMethods[nextIndex];
    selectMethod(nextMethod);
    document.getElementById(nextMethod === "member" ? memberTabId : graduateTabId)?.focus();
  }

  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="회원가입 유형"
        className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-border bg-surface-inset p-2"
      >
        <button
          id={memberTabId}
          type="button"
          role="tab"
          aria-selected={method === "member"}
          aria-controls={memberPanelId}
          tabIndex={method === "member" ? 0 : -1}
          onClick={() => selectMethod("member")}
          onKeyDown={(event) => handleTabKeyDown(event, "member")}
          className={tabClassName(method === "member")}
        >
          운영진·재학생
        </button>
        <button
          id={graduateTabId}
          type="button"
          role="tab"
          aria-selected={method === "graduate"}
          aria-controls={graduatePanelId}
          tabIndex={method === "graduate" ? 0 : -1}
          onClick={() => selectMethod("graduate")}
          onKeyDown={(event) => handleTabKeyDown(event, "graduate")}
          className={tabClassName(method === "graduate")}
        >
          수료생
        </button>
      </div>

      <section
        id={memberPanelId}
        role="tabpanel"
        aria-labelledby={memberTabId}
        hidden={method !== "member"}
        className="mt-5"
      >
        <SsafyVerifyButton returnTo={returnTo} className="mt-0" label="SSAFY Verify로 시작하기" />
      </section>
      <section
        id={graduatePanelId}
        role="tabpanel"
        aria-labelledby={graduateTabId}
        hidden={method !== "graduate"}
        className="mt-5"
      >
        <Button href={graduateHref}>수료생 인증으로 시작하기</Button>
      </section>
    </div>
  );
}
