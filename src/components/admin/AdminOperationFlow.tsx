import Link from "next/link";
import { cn } from "@/lib/cn";

export type AdminOperationFlowStep = {
  label: string;
  description: string;
  href?: string;
  state?: "complete" | "current" | "upcoming";
};

export default function AdminOperationFlow({
  steps,
  label = "운영 작업 흐름",
}: {
  steps: readonly AdminOperationFlowStep[];
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="min-w-0 rounded-card border border-border bg-surface p-3 shadow-flat"
    >
      <ol
        className={cn(
          "grid min-w-0 gap-2",
          steps.length === 2
            ? "sm:grid-cols-2"
            : steps.length === 4
              ? "sm:grid-cols-4"
              : "sm:grid-cols-3",
        )}
      >
        {steps.map((step, index) => {
          const state = step.state ?? "upcoming";
          const content = (
            <span
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                state === "current"
                  ? "border-primary/30 bg-primary-soft/60"
                  : state === "complete"
                    ? "border-success/25 bg-success/5"
                    : "border-border/70 bg-surface-inset",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  state === "current"
                    ? "border-primary bg-primary text-primary-foreground"
                    : state === "complete"
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border bg-surface text-muted-foreground",
                )}
              >
                {state === "complete" ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {step.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </span>
          );

          return (
            <li key={`${step.label}-${index}`} className="min-w-0">
              {step.href && state !== "current" ? (
                <Link
                  href={step.href}
                  prefetch={false}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
