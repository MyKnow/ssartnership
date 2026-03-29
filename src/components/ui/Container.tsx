import { cn } from "@/lib/cn";

export default function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[min(1680px,96vw)] px-4 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
