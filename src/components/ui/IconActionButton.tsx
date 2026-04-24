import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const toneClasses = {
  danger: "hover:bg-danger/10 hover:text-danger",
  success: "hover:bg-success/10 hover:text-success",
  neutral: "hover:bg-surface-elevated",
} as const;

export function IconActionGroup({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-surface-elevated p-1 shadow-raised",
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
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
