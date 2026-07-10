"use client";

import { cn } from "@/lib/cn";

export type AdminTabOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export default function AdminTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<AdminTabOption<T>>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 rounded-[1.6rem] border border-border/80 bg-surface-inset p-2",
        className ?? "sm:grid-cols-2",
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 rounded-[1.1rem] border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              active
                ? "border-foreground bg-foreground text-background shadow-raised"
                : "border-transparent text-foreground hover:border-border hover:bg-surface-control",
            )}
          >
            <span className="block truncate text-sm font-semibold">
              {option.label}
            </span>
            {option.description ? (
              <span
                className={cn(
                  "mt-1 block truncate text-xs leading-5",
                  active ? "text-background/80" : "text-muted-foreground",
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
