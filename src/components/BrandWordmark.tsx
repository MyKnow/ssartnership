import { cn } from "@/lib/cn";

export default function BrandWordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0 font-semibold tracking-[-0.04em] text-2xl",
        className,
      )}
    >
      <span className="text-[#16C2F4]">싸</span>
      <span className="text-[#1D386F] dark:text-white">트너십</span>
    </span>
  );
}
