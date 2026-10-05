"use client";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

/**
 * 파괴적·되돌릴 수 없는 작업 앞의 확인 단계. 네이티브 `window.confirm` 대신 쓴다.
 * 초기 포커스는 닫기 버튼(가장 덜 파괴적인 선택)이고, 처리 중에는 닫히지 않는다.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  pendingLabel = "처리 중",
  pending = false,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const handleClose = pending ? () => undefined : onClose;

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={handleClose}
      bodyClassName="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
    >
      <Button variant="secondary" onClick={onClose} disabled={pending}>
        {cancelLabel}
      </Button>
      <Button
        variant={danger ? "danger" : "primary"}
        onClick={onConfirm}
        loading={pending}
        loadingText={pendingLabel}
      >
        {confirmLabel}
      </Button>
    </Modal>
  );
}
