import { cn } from "@/lib/cn";

export default function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border/80", className)} aria-hidden="true" />;
}
