import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { TOUCH_TARGET_HIT_AREA_CLASS_NAME } from "@/components/ui/touch-target";
import { cn } from "@/lib/cn";
import {
  PV2_FOCUS_RING_CLASS_NAME,
  PV2_TRANSITION_CLASS_NAME,
} from "./portal-v2-classes";

export type PortalButtonVariant = "primary" | "secondary" | "danger";

const variantClassNames: Record<PortalButtonVariant, string> = {
  primary:
    "border-transparent bg-pv2-blue text-white hover:bg-pv2-hover active:bg-pv2-pressed",
  secondary:
    "border-pv2-border-strong bg-pv2-surface text-pv2-text hover:bg-pv2-blue-soft active:bg-pv2-grid",
  danger:
    "border-pv2-danger bg-pv2-surface text-pv2-danger hover:bg-pv2-danger-soft active:bg-pv2-danger-soft",
};

const disabledClassName =
  "disabled:border-transparent disabled:bg-pv2-disabled-bg disabled:text-pv2-disabled-text disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-pv2-disabled-bg aria-disabled:text-pv2-disabled-text aria-disabled:pointer-events-none";

/**
 * Button 규격: Mobile 44px / Desktop(md 이상) 40px, 좌우 16, gap 8, radius 8,
 * Label 14·22·500. 40px 시각 크기에서도 44px 히트 영역을 유지한다.
 */
export function portalButtonClassName({
  variant = "secondary",
  fullWidth = false,
  className,
}: {
  variant?: PortalButtonVariant;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-pv2-control border px-4 pv2-label whitespace-nowrap md:h-10",
    TOUCH_TARGET_HIT_AREA_CLASS_NAME,
    PV2_FOCUS_RING_CLASS_NAME,
    PV2_TRANSITION_CLASS_NAME,
    variantClassNames[variant],
    disabledClassName,
    fullWidth && "w-full",
    className,
  );
}

type CommonProps = {
  variant?: PortalButtonVariant;
  fullWidth?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

export type PortalButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, "children"> & {
    /** 처리 중: 비활성화하고 `aria-busy`를 달아 중복 제출을 막는다. */
    loading?: boolean;
    loadingText?: string;
  };

export default function PortalButton({
  variant,
  fullWidth,
  icon,
  className,
  children,
  type = "button",
  loading = false,
  loadingText,
  disabled,
  ...props
}: PortalButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={portalButtonClassName({ variant, fullWidth, className })}
    >
      {icon ? <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 truncate">{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

export type PortalButtonLinkProps = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "children">;

export function PortalButtonLink({
  variant,
  fullWidth,
  icon,
  className,
  children,
  ...props
}: PortalButtonLinkProps) {
  return (
    <Link
      {...props}
      className={portalButtonClassName({ variant, fullWidth, className })}
    >
      {icon ? <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
