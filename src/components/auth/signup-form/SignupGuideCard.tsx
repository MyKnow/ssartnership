import type { SignupGuideItem } from "@/components/auth/signup-form/types";

export default function SignupGuideCard({
  items,
}: {
  items: SignupGuideItem[];
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-surface px-4 py-4 shadow-[var(--shadow-flat)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">가입 안내</h2>
        <span className="text-xs text-muted-foreground">입력 전에 확인해 주세요</span>
      </div>
      <dl className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/60 bg-background/35">
        {items.map((item) => (
          <div
            key={item.label}
            className="px-3 py-2.5"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm leading-6 text-foreground-soft">
              {item.description}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
