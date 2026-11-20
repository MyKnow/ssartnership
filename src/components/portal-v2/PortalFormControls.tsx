import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { portalFieldProps } from "./portal-field-props";
import { PV2_FOCUS_RING_CLASS_NAME } from "./portal-v2-classes";

export { portalFieldProps };

/**
 * 컨트롤 규격: 모바일 44 / md 이상 40, 좌우 12, radius 8, border `border-strong` 1px,
 * Body 14·22. 오류는 색만이 아니라 border 두께와 `PortalField`의 오류 문구로도 구분한다.
 */
export const PV2_CONTROL_CLASS_NAME = cn(
  "h-11 w-full min-w-0 rounded-pv2-control border border-pv2-border-strong bg-pv2-surface px-3 pv2-body text-pv2-text md:h-10",
  "placeholder:text-pv2-muted",
  PV2_FOCUS_RING_CLASS_NAME,
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-pv2-disabled-bg disabled:text-pv2-disabled-text",
  "aria-invalid:border-2 aria-invalid:border-pv2-danger",
);

export const PortalInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PortalInput({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cn(PV2_CONTROL_CLASS_NAME, className)} />;
});

export const PortalSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function PortalSelect({ className, children, ...props }, ref) {
  return (
    <select ref={ref} {...props} className={cn(PV2_CONTROL_CLASS_NAME, "pr-8", className)}>
      {children}
    </select>
  );
});

export const PortalTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function PortalTextarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      className={cn(PV2_CONTROL_CLASS_NAME, "h-auto min-h-24 py-2 md:h-auto", className)}
    />
  );
});

/**
 * 라벨·도움말·오류를 한 묶음으로 둔다. 컨트롤에는 `portalFieldProps`를 펼쳐
 * `id`·`aria-invalid`·`aria-describedby`를 연결한다. 오류가 있으면 도움말 대신
 * 오류를 보여 주고 `role="alert"`로 알린다.
 */
export function PortalField({
  name,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={name} className="pv2-label text-pv2-text">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-pv2-danger">
              *
            </span>
            <span className="sr-only"> (필수)</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} role="alert" className="pv2-caption text-ko-pretty text-pv2-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="pv2-caption text-ko-pretty text-pv2-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
