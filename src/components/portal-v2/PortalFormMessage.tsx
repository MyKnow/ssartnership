import { cn } from "@/lib/cn";

const variants = {
  error: "rounded-pv2-control border border-pv2-danger bg-pv2-danger-soft px-4 py-3 text-pv2-danger",
  info: "rounded-pv2-control border border-pv2-blue bg-pv2-blue-soft px-4 py-3 text-pv2-blue",
  muted: "text-pv2-muted",
};

/** 폼 단위 안내·오류. 오류는 색과 border로 구분하고 `role="alert"`로 알린다. */
export default function PortalFormMessage({
  children,
  variant = "muted",
  className,
  id,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  id?: string;
}) {
  return (
    <p
      id={id}
      role={variant === "error" ? "alert" : undefined}
      className={cn("pv2-body text-ko-pretty", variants[variant], className)}
    >
      {children}
    </p>
  );
}
