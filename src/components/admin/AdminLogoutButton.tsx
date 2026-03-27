"use client";

import SubmitButton from "@/components/ui/SubmitButton";

type AdminLogoutButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export default function AdminLogoutButton({ action }: AdminLogoutButtonProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const ok = window.confirm("로그아웃하시겠습니까?");
    if (!ok) {
      event.preventDefault();
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit}>
      <SubmitButton variant="ghost" pendingText="로그아웃 중">
        로그아웃
      </SubmitButton>
    </form>
  );
}
