"use client";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
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
        취소
      </Button>
      <Button
        variant={danger ? "danger" : "primary"}
        onClick={onConfirm}
        loading={pending}
        loadingText="처리 중"
      >
        {confirmLabel}
      </Button>
    </Modal>
  );
}
