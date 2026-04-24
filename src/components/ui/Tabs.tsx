"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type TabOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export default function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<TabOption<T>>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 rounded-[1.6rem] border border-border/80 bg-surface-inset p-2 shadow-none sm:grid-cols-2", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative overflow-hidden rounded-[1.1rem] px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
              active ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="tabs-active-pill"
                className="absolute inset-0 rounded-[1.1rem] bg-primary shadow-raised"
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              />
            ) : null}
            <span className="relative block text-sm font-semibold">{option.label}</span>
            {option.description ? (
              <span
                className={cn(
                  "relative mt-1 block text-xs leading-5",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
