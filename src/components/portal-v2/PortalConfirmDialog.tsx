"use client";

import Modal from "@/components/ui/Modal";
import PortalButton from "./PortalButton";

/**
 * 파괴적·되돌릴 수 없는 작업 앞의 확인 단계(v2). 포커스 순환·Escape·복귀는 공용 `Modal`
 * 계약을 그대로 쓰고, 처리 중에는 닫히지 않으며 취소·확인이 모두 잠긴다.
 */
export default function PortalConfirmDialog({
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
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={pending ? () => undefined : onClose}
      bodyClassName="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
    >
      <PortalButton variant="secondary" onClick={onClose} disabled={pending}>
        {cancelLabel}
      </PortalButton>
      <PortalButton
        variant={danger ? "danger" : "primary"}
        onClick={onConfirm}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? pendingLabel : confirmLabel}
      </PortalButton>
    </Modal>
  );
}
