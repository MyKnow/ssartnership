import { cn } from "@/lib/cn";

export default function Container({
  children,
  className,
  size = "page",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "narrow" | "page" | "wide" | "dashboard";
}) {
  const sizeClassName =
    size === "narrow"
      ? "max-w-[min(56rem,calc(100vw-1.5rem))]"
      : size === "dashboard"
        ? "max-w-[min(var(--grid-dashboard),calc(100vw-1rem))]"
      : size === "wide"
        ? "max-w-[min(var(--grid-wide),calc(100vw-1.5rem))]"
        : "max-w-[min(var(--grid-max),calc(100vw-1.5rem))]";

  return (
    <div
      className={cn(
        "mx-auto w-full px-3 sm:px-6 lg:px-8",
        sizeClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
