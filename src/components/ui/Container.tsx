import { cn } from "@/lib/cn";

export default function Container({
  children,
  className,
  size = "page",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "narrow" | "page" | "wide";
}) {
  const sizeClassName =
    size === "narrow"
      ? "max-w-[min(56rem,calc(100vw-2rem))]"
      : size === "wide"
        ? "max-w-[min(var(--grid-wide),calc(100vw-2rem))]"
        : "max-w-[min(var(--grid-max),calc(100vw-2rem))]";

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        sizeClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
