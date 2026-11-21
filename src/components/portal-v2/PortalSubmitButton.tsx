"use client";

import { useFormStatus } from "react-dom";
import PortalButton, { type PortalButtonVariant } from "./PortalButton";

/** 부모 `form`의 pending 상태를 읽는 v2 제출 버튼. 반드시 제출할 form 안에 둔다. */
export default function PortalSubmitButton({
  children,
  pendingText = "처리 중",
  variant = "primary",
  fullWidth,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: PortalButtonVariant;
  fullWidth?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <PortalButton
      type="submit"
      variant={variant}
      fullWidth={fullWidth}
      className={className}
      loading={pending}
      loadingText={pendingText}
    >
      {children}
    </PortalButton>
  );
}
