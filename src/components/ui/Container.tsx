import { cn } from "@/lib/cn";

export default function Container({
  children,
  className,
  fullWidthOnMobile = false,
  size = "page",
}: {
  children: React.ReactNode;
  className?: string;
  fullWidthOnMobile?: boolean;
  size?: "narrow" | "page" | "wide" | "dashboard";
}) {
  const sizeClassName =
    size === "narrow"
      ? fullWidthOnMobile
        ? "max-w-none sm:max-w-[min(56rem,calc(100vw-1.5rem))]"
        : "max-w-[min(56rem,calc(100vw-1.5rem))]"
      : size === "dashboard"
        ? "max-w-none"
        : size === "wide"
          ? fullWidthOnMobile
            ? "max-w-none sm:max-w-[min(var(--grid-wide),calc(100vw-1.5rem))]"
            : "max-w-[min(var(--grid-wide),calc(100vw-1.5rem))]"
          : fullWidthOnMobile
            ? "max-w-none sm:max-w-[min(var(--grid-max),calc(100vw-1.5rem))]"
            : "max-w-[min(var(--grid-max),calc(100vw-1.5rem))]";
  const paddingClassName =
    size === "dashboard"
      ? "px-3 sm:px-4 lg:px-5 xl:px-6"
      : fullWidthOnMobile
        ? "px-0 sm:px-6 lg:px-8"
        : "px-3 sm:px-6 lg:px-8";

  return (
    <div
      className={cn(
        "mx-auto w-full",
        paddingClassName,
        sizeClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
