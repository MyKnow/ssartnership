import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageSectionProps = ComponentPropsWithoutRef<"section"> & {
  title?: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  headingLevel?: "h2" | "h3";
};

export default function PageSection({
  title,
  description,
  eyebrow,
  actions,
  headingLevel = "h2",
  children,
  className,
  ...props
}: PageSectionProps) {
  const Heading = headingLevel;

  return (
    <section className={cn("min-w-0 space-y-5", className)} {...props}>
      {title ? (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
            <Heading className="ui-section-title text-ko-title text-balance">
              {title}
            </Heading>
            {description ? (
              <p className="ui-body text-ko-pretty max-w-3xl">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
