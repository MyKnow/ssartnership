import type { ReactNode } from "react";
import MotionReveal from "@/components/ui/MotionReveal";

export default function HeroSection({
  eyebrow,
  title,
  description,
  headingLevel = "h1",
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;

  return (
    <MotionReveal>
      <section className="hero-surface relative overflow-hidden rounded-[var(--radius-overlay)] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="absolute inset-0 ui-decor-grid opacity-25" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="hero-eyebrow text-sm font-semibold uppercase tracking-[0.28em]">
            {eyebrow}
          </p>
          <Heading className="mt-4 text-[clamp(1.5rem,5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.05em]">
            {title}
          </Heading>
          <p className="hero-body mt-4 max-w-2xl text-sm leading-7 sm:text-base">
            {description}
          </p>
        </div>
      </section>
    </MotionReveal>
  );
}
