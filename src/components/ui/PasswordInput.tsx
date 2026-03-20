"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export default function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(
          "w-full rounded-2xl border border-border bg-surface px-3 py-2 pr-11 text-sm text-foreground placeholder:text-muted",
          "focus:border-strong focus:outline-none",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:text-foreground"
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
