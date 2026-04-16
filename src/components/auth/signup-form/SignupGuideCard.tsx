import type { SignupGuideItem } from "@/components/auth/signup-form/types";

export default function SignupGuideCard({
  items,
}: {
  items: SignupGuideItem[];
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">가입 안내</h2>
        <span className="text-xs text-muted-foreground">입력 전에 확인해 주세요</span>
      </div>
      <dl className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/60 bg-background/70 px-3 py-2"
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm leading-6 text-foreground/90">{item.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
