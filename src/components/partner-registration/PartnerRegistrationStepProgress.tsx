import { cn } from "@/lib/cn";
import {
  getPartnerRegistrationStepIndex,
  getPartnerRegistrationStepSummary,
  PARTNER_REGISTRATION_STEPS,
  type PartnerRegistrationStepId,
} from "./registration-steps";

export default function PartnerRegistrationStepProgress({
  activeStep,
  onStepClick,
}: {
  activeStep: PartnerRegistrationStepId;
  onStepClick: (stepId: PartnerRegistrationStepId) => void;
}) {
  const activeIndex = getPartnerRegistrationStepIndex(activeStep);

  return (
    <nav
      aria-label="파트너 등록 단계"
      className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset p-2"
    >
      <div className="grid min-w-0 gap-2 sm:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3 px-1 py-0.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {getPartnerRegistrationStepSummary(activeStep)}
          </p>
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            필수값 확인 후 이동
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-5 gap-1.5">
          {PARTNER_REGISTRATION_STEPS.map((step, index) => {
            const active = step.id === activeStep;
            const complete = index < activeIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepClick(step.id)}
                aria-label={`${index + 1}/${PARTNER_REGISTRATION_STEPS.length} ${step.label}`}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-8 min-w-0 items-center justify-center rounded-[0.7rem] border text-xs font-semibold transition-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : complete
                      ? "border-primary/20 bg-primary-soft text-primary"
                      : "border-border bg-surface-control text-muted-foreground",
                )}
              >
                {complete ? "✓" : index + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden min-w-0 gap-2 sm:grid sm:grid-cols-5">
        {PARTNER_REGISTRATION_STEPS.map((step, index) => {
          const active = step.id === activeStep;
          const complete = index < activeIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick(step.id)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "grid min-h-16 min-w-0 gap-1 rounded-[0.85rem] border px-3 py-2 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                active
                  ? "border-primary/25 bg-primary text-primary-foreground shadow-flat"
                  : complete
                    ? "border-primary/15 bg-primary-soft text-primary"
                    : "border-transparent bg-transparent text-foreground hover:bg-surface-control",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                    active
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : complete
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-control text-muted-foreground",
                  )}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </span>
              <span
                className={cn(
                  "line-clamp-1 text-[11px] leading-4",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {step.description}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
