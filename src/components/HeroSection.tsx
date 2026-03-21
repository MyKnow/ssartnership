import type { ReactNode } from "react";

export default function HeroSection({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <section className="hero-surface rounded-3xl px-8 py-10 shadow-lg">
      <div className="max-w-2xl">
        <p className="hero-eyebrow text-sm font-semibold uppercase tracking-[0.24em]">
          {eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight">{title}</h2>
        <p className="hero-body mt-4 text-base">{description}</p>
      </div>
    </section>
  );
}
