"use client";

import { useState } from "react";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type PasswordResetAction = "copy" | "email";

type PasswordResetResponse = {
  ok?: unknown;
  message?: unknown;
  resetUrl?: unknown;
};

function getErrorMessage(body: PasswordResetResponse | null) {
  return typeof body?.message === "string"
    ? body.message
    : "비밀번호 재발급 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function AdminMemberPasswordResetPanel({
  memberId,
  displayName,
  email,
  emailVerifiedAt,
}: {
  memberId: string;
  displayName: string;
  email: string | null | undefined;
  emailVerifiedAt: string | null | undefined;
}) {
  const { notify } = useToast();
  const [confirmAction, setConfirmAction] = useState<PasswordResetAction | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const canSendEmail = Boolean(email);

  const issueLink = async (delivery: PasswordResetAction) => {
    setIsPending(true);
    // A new request revokes the prior unused token even if delivery later
    // fails, so never leave a stale link visible to the administrator.
    setResetUrl(null);
    try {
      const result = await fetch(
        `/api/admin/members/${encodeURIComponent(memberId)}/password-reset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivery }),
        },
      );
      const body = (await result.json().catch(() => null)) as PasswordResetResponse | null;
      if (!result.ok || body?.ok !== true) {
        notify(getErrorMessage(body));
        return;
      }
      if (delivery === "copy") {
        if (typeof body.resetUrl !== "string" || !body.resetUrl) {
          notify("비밀번호 재발급 링크를 확인하지 못했습니다. 다시 생성해 주세요.");
          return;
        }
        setResetUrl(body.resetUrl);
        notify("비밀번호 재발급 링크를 생성했습니다.");
        return;
      }
      notify(
        emailVerifiedAt
          ? "인증된 이메일로 비밀번호 재발급 링크를 발송했습니다."
          : "등록된 이메일로 비밀번호 재발급 링크를 발송했습니다. 수신한 링크로 비밀번호를 설정하면 이메일 인증도 완료됩니다.",
      );
    } catch {
      notify("비밀번호 재발급 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsPending(false);
      setConfirmAction(null);
    }
  };

  const copyResetUrl = async () => {
    if (!resetUrl) return;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(resetUrl);
      notify("비밀번호 재발급 링크를 복사했습니다.");
    } catch {
      notify("링크를 복사하지 못했습니다. 직접 선택해 복사해 주세요.");
    }
  };

  const confirmDescription = confirmAction === "email"
    ? emailVerifiedAt
      ? `${displayName} 회원의 인증된 이메일로 재발급 링크를 발송합니다. 기존에 사용하지 않은 재발급 링크는 즉시 무효화됩니다.`
      : `${displayName} 회원의 등록된 이메일로 재발급 링크를 발송합니다. 수신한 링크로 비밀번호를 설정하면 이메일 인증도 완료됩니다. 기존에 사용하지 않은 재발급 링크는 즉시 무효화됩니다.`
    : `${displayName} 회원의 새 비밀번호 재발급 링크를 생성합니다. 기존에 사용하지 않은 재발급 링크는 즉시 무효화됩니다.`;

  return (
    <section className="grid gap-3 border-t border-border/70 pt-4">
      <AdminSectionHeading
        title="비밀번호 재발급"
        description="한 번만 사용할 수 있는 링크는 24시간 동안 유효합니다. 링크 생성·발송 기록에는 URL이나 토큰을 남기지 않습니다."
      />
      <p className="break-all text-sm text-muted-foreground">
        이메일: {email ?? "미등록"} {email ? (emailVerifiedAt ? "· 인증됨" : "· 미인증") : ""}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setConfirmAction("copy")}
          disabled={isPending}
        >
          링크 생성
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setConfirmAction("email")}
          disabled={isPending || !canSendEmail}
          title={canSendEmail ? undefined : "등록된 이메일이 있는 회원에게만 발송할 수 있습니다."}
        >
          이메일로 발송
        </Button>
      </div>
      {!canSendEmail ? (
        <p className="text-xs leading-5 text-muted-foreground">
          등록된 이메일이 없는 회원은 링크를 생성해 안전한 경로로 직접 전달해 주세요.
        </p>
      ) : null}
      {resetUrl ? (
        <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset p-3">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            발급된 비밀번호 재발급 링크
            <Input
              value={resetUrl}
              readOnly
              aria-label="발급된 비밀번호 재발급 링크"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <Button type="button" variant="soft" className="w-full" onClick={copyResetUrl}>
            링크 복사
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            이 화면을 닫거나 새 링크를 만들면 다시 확인할 수 없습니다.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            직접 전달한 링크로는 이메일 인증 상태가 바뀌지 않습니다.
          </p>
        </div>
      ) : null}
      <AdminConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "email" ? "비밀번호 재발급 이메일 발송" : "비밀번호 재발급 링크 생성"}
        description={confirmDescription}
        confirmLabel={confirmAction === "email" ? "이메일 발송" : "링크 생성"}
        pending={isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            void issueLink(confirmAction);
          }
        }}
      />
    </section>
  );
}
