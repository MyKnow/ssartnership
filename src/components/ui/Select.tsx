import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { FOCUS_RING_ON_BACKGROUND_CLASS_NAME } from "@/components/ui/focus-ring";

/**
 * 공용 셀렉트. 접근 이름은 호출처가 보이는 `<label>`(감싸기 또는 htmlFor),
 * `aria-labelledby`, 또는 한국어 `aria-label`로 직접 준다.
 * `name`·고정 문구로 접근 이름을 대신 채우지 않는다(보이는 라벨을 덮어 영문 필드명을 읽는다).
 */
const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        className={cn(
          "h-11 w-full appearance-none rounded-[1rem] border border-border bg-surface-control px-3.5 pr-10 text-base text-foreground shadow-flat transition-field duration-200 ease-out sm:text-sm",
          "focus:border-strong focus:bg-surface-elevated focus:outline-hidden",
          FOCUS_RING_ON_BACKGROUND_CLASS_NAME,
          "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-inset disabled:text-muted-foreground disabled:opacity-100",
          className,
        )}
      />
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M5.25 7.5 10 12.25 14.75 7.5" />
      </svg>
    </div>
  );
});

export default Select;
