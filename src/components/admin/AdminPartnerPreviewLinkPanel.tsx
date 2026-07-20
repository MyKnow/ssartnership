"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import InlineMessage from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";

export type PartnerPreviewLinkActionResult = {
  previewUrl: string;
};

export type PartnerPreviewLinkPanelProps = {
  partnerId: string;
  hasActiveLink: boolean;
  initialPreviewUrl?: string | null;
  generateAction: (partnerId: string) => Promise<PartnerPreviewLinkActionResult>;
  removeAction: (partnerId: string) => Promise<void>;
};

export default function AdminPartnerPreviewLinkPanel({
  partnerId,
  hasActiveLink: initialHasActiveLink,
  initialPreviewUrl = null,
  generateAction,
  removeAction,
}: PartnerPreviewLinkPanelProps) {
  const [hasActiveLink, setHasActiveLink] = useState(initialHasActiveLink);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { notify } = useToast();

  const handleGenerate = () => {
    setMessage(null);
    startTransition(() => {
      void generateAction(partnerId)
        .then((result) => {
          setPreviewUrl(result.previewUrl);
          setHasActiveLink(true);
          notify("미리보기 링크를 생성했습니다.");
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "미리보기 링크 생성에 실패했습니다.");
        });
    });
  };

  const handleCopy = () => {
    if (!previewUrl) {
      return;
    }
    void (async () => {
      try {
        if (!navigator.clipboard) {
          throw new Error("clipboard_unavailable");
        }
        await navigator.clipboard.writeText(previewUrl);
        notify("미리보기 링크를 복사했습니다.");
      } catch {
        setMessage("미리보기 링크 복사에 실패했습니다.");
      }
    })();
  };

  const handleRemove = () => {
    setMessage(null);
    startTransition(() => {
      void removeAction(partnerId)
        .then(() => {
          setPreviewUrl(null);
          setHasActiveLink(false);
          notify("미리보기 링크를 제거했습니다.");
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "미리보기 링크 제거에 실패했습니다.");
        });
    });
  };

  return (
    <Card tone="elevated" padding="md">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <p className="ui-kicker">Partner Preview</p>
          <h3 className="ui-section-title text-ko-title">미리보기 링크</h3>
          <p className="ui-body text-ko-pretty">
            제휴사에 실제 사용자 화면을 안내할 때 사용하는 비공개 링크입니다. 새 링크를 생성하면 기존 링크는 즉시 사용할 수 없게 됩니다.
          </p>
        </div>

        {message ? <InlineMessage tone="danger" title="처리하지 못했습니다." description={message} /> : null}

        {previewUrl ? (
          <div className="grid gap-3">
            <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="partner-preview-url">
              현재 링크
              <input
                id="partner-preview-url"
                readOnly
                value={previewUrl}
                className="min-h-11 min-w-0 rounded-[1rem] border border-border bg-surface-inset px-3 text-sm font-normal text-muted-foreground outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" onClick={handleCopy} disabled={isPending}>
                링크 복사
              </Button>
              <Button type="button" variant="secondary" onClick={handleGenerate} loading={isPending} loadingText="생성 중">
                새 링크 생성
              </Button>
              <Button type="button" variant="danger" onClick={handleRemove} loading={isPending} loadingText="제거 중">
                링크 제거
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
            <p className="text-sm leading-6 text-muted-foreground">
              {hasActiveLink
                ? "현재 발급된 링크가 있습니다. 이전 발급 링크는 보안상 다시 표시할 수 없으므로 새 링크를 생성해 주세요."
                : "아직 발급된 미리보기 링크가 없습니다."}
            </p>
            <Button type="button" variant="secondary" onClick={handleGenerate} loading={isPending} loadingText="생성 중">
              {hasActiveLink ? "새 링크 생성" : "링크 생성"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
