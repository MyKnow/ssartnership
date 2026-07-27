"use client";

import { useRef, useState } from "react";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import SubmitButton from "@/components/ui/SubmitButton";

type AdminLogoutButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
};

export default function AdminLogoutButton({
  action,
  className,
}: AdminLogoutButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowSubmitRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (allowSubmitRef.current) {
      allowSubmitRef.current = false;
      return;
    }
    event.preventDefault();
    setConfirmOpen(true);
  };

  const confirmLogout = () => {
    allowSubmitRef.current = true;
    setConfirmOpen(false);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={action} onSubmit={handleSubmit}>
        <SubmitButton
          variant="danger"
          pendingText="로그아웃 중"
          className={className}
        >
          로그아웃
        </SubmitButton>
      </form>
      <AdminConfirmDialog
        open={confirmOpen}
        title="로그아웃"
        description="현재 관리자 세션을 종료하고 로그인 화면으로 이동합니다."
        confirmLabel="로그아웃"
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}
