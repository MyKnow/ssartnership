"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PV2_CONTROL_CLASS_NAME } from "./PortalFormControls";
import { PV2_FOCUS_RING_CLASS_NAME } from "./portal-v2-classes";

/** 비밀번호 보기 토글이 있는 v2 입력. 토글은 44px 조작 영역을 유지한다. */
const PortalPasswordInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(function PortalPasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        className={cn(PV2_CONTROL_CLASS_NAME, "pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        aria-pressed={visible}
        className={cn(
          "absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-pv2-control text-pv2-muted hover:text-pv2-text",
          PV2_FOCUS_RING_CLASS_NAME,
        )}
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
});

export default PortalPasswordInput;
