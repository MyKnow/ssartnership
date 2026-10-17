import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { getNotificationChannelLabel } from "@/lib/notifications/shared";
import type { AdminNotificationPreview } from "@/lib/admin-notification-ops-types";
import { typeLabels } from "./constants";

export function SendConfirmModal({
  open,
  pending,
  preview,
  title,
  body,
  confirmationText,
  onChangeConfirmationText,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  preview: AdminNotificationPreview;
  title: string;
  body: string;
  confirmationText: string;
  onChangeConfirmationText: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isConfirmationPhraseValid =
    !preview.requiresConfirmation ||
    confirmationText.trim() === preview.confirmationPhrase;

  return (
    <Modal
      open={open}
      title={`${preview.eligibleMemberCount}명에게 발송`}
      description={`정말 ${preview.eligibleMemberCount}명에게 ${typeLabels[preview.notificationType]}를 발송할까요?`}
      onClose={onClose}
      panelClassName="max-w-2xl"
      bodyClassName="block"
    >
      <div className="w-full space-y-4">
        <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
          <p>대상 범위 {preview.audienceLabel}</p>
          <p>선택 채널 {preview.selectedChannels.map(getNotificationChannelLabel).join(" · ")}</p>
          <p>예상 수신자 {preview.eligibleMemberCount}명</p>
          <p>예상 전송 {preview.channels.reduce((sum, channel) => sum + channel.eligibleCount, 0)}건</p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-foreground">제목</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-foreground">내용</p>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
          </div>
        </div>

        {preview.requiresConfirmation ? (
          <label className="grid gap-2 text-sm font-medium text-foreground">
            확인 문구 입력
            <Input
              value={confirmationText}
              onChange={(event) => onChangeConfirmationText(event.target.value)}
              placeholder={preview.confirmationPhrase}
            />
          </label>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button
            size="lg"
            className="w-full justify-center lg:w-auto"
            onClick={onConfirm}
            loading={pending}
            loadingText="발송 중"
            disabled={!isConfirmationPhraseValid}
          >
            메시지 보내기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
