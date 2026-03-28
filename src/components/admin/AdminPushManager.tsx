"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

type Props = {
  configured: boolean;
  activeSubscriptions: number;
  enabledMembers: number;
};

export default function AdminPushManager({
  configured,
  activeSubscriptions,
  enabledMembers,
}: Props) {
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      notify("VAPID 환경 변수와 CRON 시크릿이 준비된 뒤 발송할 수 있습니다.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/push/admin/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body, url }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
            result?: {
              targeted: number;
              delivered: number;
              failed: number;
            };
          }
        | null;
      if (!response.ok) {
        throw new Error(data?.message ?? "공지 알림 발송에 실패했습니다.");
      }

      setTitle("");
      setBody("");
      setUrl("");
      notify(
        `공지 알림 발송 완료: ${data?.result?.delivered ?? 0}건 성공, ${data?.result?.failed ?? 0}건 실패`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "공지 알림 발송에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="rounded-full border border-border bg-surface-muted px-3 py-1">
          활성 구독 {activeSubscriptions}개
        </span>
        <span className="rounded-full border border-border bg-surface-muted px-3 py-1">
          알림 허용 회원 {enabledMembers}명
        </span>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="알림 제목"
          maxLength={60}
          required
        />
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="알림 내용"
          rows={4}
          maxLength={160}
          required
        />
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="이동 URL (예: /partners/uuid 또는 https://...)"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !configured}>
            <span className="inline-flex items-center gap-2">
              {pending ? <Spinner /> : null}
              전체 공지 발송
            </span>
          </Button>
          <p className="text-xs text-muted-foreground">
            신규 제휴와 종료 7일 전 알림은 자동 발송됩니다.
          </p>
        </div>
      </form>
    </div>
  );
}
