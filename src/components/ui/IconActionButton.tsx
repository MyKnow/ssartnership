import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";
import {
  TOUCH_TARGET_GROUP_GAP_CLASS_NAME,
  TOUCH_TARGET_HIT_AREA_CLASS_NAME,
} from "@/components/ui/touch-target";

const toneClasses = {
  danger: "hover:bg-danger/10 hover:text-danger",
  success: "hover:bg-success/10 hover:text-success",
  neutral: "hover:bg-surface-elevated",
} as const;

export function IconActionGroup({
  children,
  className,
  density = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /**
   * `default`는 IconActionButton의 44px 히트 영역이 겹치지 않는 12px 간격,
   * `tight`는 자식이 자체 히트 영역 규칙을 가진 경우의 4px 간격이다.
   */
  density?: "default" | "tight";
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border/70 bg-surface-elevated p-1 shadow-raised",
        density === "tight" ? "gap-1" : TOUCH_TARGET_GROUP_GAP_CLASS_NAME,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
};

/** 시각 32px 아이콘 버튼. 터치 히트 영역은 44×44, 포커스 링은 Button과 같은 토큰을 쓴다. */
export default function IconActionButton({
  children,
  className,
  tone = "neutral",
  type = "button",
  ...props
}: IconActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-foreground transition-fade-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        TOUCH_TARGET_HIT_AREA_CLASS_NAME,
        FOCUS_RING_CLASS_NAME,
        "focus-visible:ring-offset-surface-elevated",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
