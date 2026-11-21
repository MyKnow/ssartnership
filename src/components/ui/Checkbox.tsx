import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

export default function Checkbox({ className, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
  return <input {...props} type="checkbox" className={cn("h-5 w-5 shrink-0 accent-primary", className)} />;
}
