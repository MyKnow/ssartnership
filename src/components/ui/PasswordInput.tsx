"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { FOCUS_RING_ON_BACKGROUND_CLASS_NAME } from "@/components/ui/focus-ring";

const PasswordInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({
  className,
  ...props
}, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        className={cn(
          "h-11 w-full rounded-[1rem] border border-border bg-surface-control px-3.5 pr-11 text-sm text-foreground shadow-flat transition-field duration-200 ease-out placeholder:text-muted-foreground",
          "focus:border-strong focus:bg-surface-elevated focus:outline-hidden",
          FOCUS_RING_ON_BACKGROUND_CLASS_NAME,
          "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-inset disabled:text-muted-foreground disabled:opacity-100",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

export default PasswordInput;
