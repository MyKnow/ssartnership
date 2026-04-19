import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Skeleton from "@/components/ui/Skeleton";

function StaticSkeleton({ className }: { className?: string }) {
  return <Skeleton animated={false} className={className} />;
}

function LoadingHeader() {
  return (
    <>
      <div
        aria-hidden="true"
        className="min-h-[calc(5rem+env(safe-area-inset-top))]"
      />
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="border-b border-border bg-surface-overlay/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <Container className="flex items-center justify-between gap-3 py-4" size="wide">
            <StaticSkeleton className="h-7 w-36 rounded-lg" />
            <div className="flex items-center gap-2">
              <StaticSkeleton className="hidden h-10 w-28 rounded-full sm:block" />
              <StaticSkeleton className="h-10 w-10 rounded-full" />
              <StaticSkeleton className="h-10 w-10 rounded-full" />
              <StaticSkeleton className="h-10 w-10 rounded-full" />
            </div>
          </Container>
        </div>
      </header>
    </>
  );
}

function SectionHeadingSkeleton({
  eyebrowWidth = "w-24",
  titleWidth = "w-56",
  descriptionWidth = "max-w-2xl",
}: {
  eyebrowWidth?: string;
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <div className="grid gap-2">
      <StaticSkeleton className={`h-4 ${eyebrowWidth} rounded-lg`} />
      <StaticSkeleton className={`h-8 ${titleWidth} rounded-xl`} />
      <StaticSkeleton className={`h-4 w-full ${descriptionWidth}`} />
      <StaticSkeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <section className="hero-surface animate-pulse motion-reduce:animate-none rounded-3xl px-8 py-10 shadow-[var(--shadow-floating)]">
      <StaticSkeleton className="h-4 w-40 rounded-lg bg-white/15 dark:bg-white/10" />
      <StaticSkeleton className="mt-4 h-10 w-full max-w-2xl rounded-xl bg-white/15 dark:bg-white/10" />
      <StaticSkeleton className="mt-4 h-4 w-full max-w-2xl rounded-lg bg-white/15 dark:bg-white/10" />
      <StaticSkeleton className="mt-2 h-4 w-full max-w-xl rounded-lg bg-white/15 dark:bg-white/10" />
    </section>
  );
}

function PartnerCardSkeleton() {
  return (
    <article className="flex h-full w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-flat)]">
      <div className="flex gap-4">
        <StaticSkeleton className="aspect-square w-24 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <StaticSkeleton className="h-6 w-36 max-w-[70%]" />
          <StaticSkeleton className="mt-3 h-4 w-full max-w-[85%]" />
          <StaticSkeleton className="mt-2 h-4 w-40 max-w-[60%]" />
          <div className="mt-4 flex flex-wrap gap-2">
            <StaticSkeleton className="h-8 w-16 rounded-full" />
            <StaticSkeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <StaticSkeleton className="h-12 w-28 rounded-full" />
      </div>
    </article>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none rounded-[28px] border border-border bg-surface-elevated p-5 shadow-[var(--shadow-raised)]">
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex items-start gap-3">
          <StaticSkeleton className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <StaticSkeleton className="h-6 w-48" />
            <StaticSkeleton className="mt-2 h-4 w-full max-w-lg" />
          </div>
        </div>
        <div className="flex justify-end">
          <StaticSkeleton className="h-12 w-32 rounded-full" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="animate-pulse motion-reduce:animate-none flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <StaticSkeleton key={index} className="h-11 w-24 rounded-full" />
          ))}
        </div>
        <div className="animate-pulse motion-reduce:animate-none flex flex-col gap-3 rounded-2xl border border-border bg-surface-inset p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <StaticSkeleton className="h-4 w-10 rounded-lg" />
            <StaticSkeleton className="mt-2 h-12 w-full rounded-2xl" />
          </div>
          <div className="md:w-56">
            <StaticSkeleton className="h-4 w-36 rounded-lg" />
            <StaticSkeleton className="mt-2 h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthFieldRowSkeleton({
  labelWidth = "w-20",
}: {
  labelWidth?: string;
}) {
  return (
    <div className="grid gap-2">
      <StaticSkeleton className={`h-4 ${labelWidth} rounded-lg`} />
      <StaticSkeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}

function AuthCardSkeleton({
  titleWidth = "w-28",
  descriptionWidth = "max-w-sm",
  fieldCount = 2,
  secondaryAction = true,
  extraRows = 0,
  className,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  fieldCount?: number;
  secondaryAction?: boolean;
  extraRows?: number;
  className?: string;
}) {
  return (
    <Card className={className ?? "mx-auto max-w-lg p-6 sm:p-8"}>
      <div className="grid gap-2">
        <StaticSkeleton className="h-4 w-20 rounded-lg" />
        <StaticSkeleton className={`h-8 ${titleWidth}`} />
        <StaticSkeleton className={`h-4 w-full ${descriptionWidth}`} />
      </div>

      <div className="mt-6 grid gap-4">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <AuthFieldRowSkeleton
            key={index}
            labelWidth={index === 0 ? "w-24" : "w-20"}
          />
        ))}

        {Array.from({ length: extraRows }).map((_, index) => (
          <div key={index} className="grid gap-2 rounded-2xl border border-border/70 bg-surface-inset/70 p-4">
            <StaticSkeleton className="h-4 w-28 rounded-lg" />
            <StaticSkeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <StaticSkeleton className="h-12 w-40 rounded-full" />
          {secondaryAction ? <StaticSkeleton className="h-12 w-32 rounded-full" /> : null}
        </div>
      </div>
    </Card>
  );
}

function ConsentPolicyRowSkeleton() {
  return (
    <div className="grid gap-2 rounded-2xl border border-border/70 bg-surface-inset p-4">
      <div className="flex items-start gap-3">
        <StaticSkeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <StaticSkeleton className="h-5 w-48" />
          <StaticSkeleton className="h-4 w-full max-w-lg" />
          <StaticSkeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <StaticSkeleton className="h-7 w-14 rounded-full" />
        <StaticSkeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

function NotificationItemSkeleton() {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
      <StaticSkeleton className="h-12 w-12 rounded-2xl" />
      <div className="grid gap-2">
        <StaticSkeleton className="h-5 w-48" />
        <StaticSkeleton className="h-4 w-full max-w-2xl" />
        <StaticSkeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <StaticSkeleton className="h-8 w-16 rounded-full" />
        <StaticSkeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

function CertificationFrameSkeleton() {
  return (
    <Card className="mx-auto max-w-2xl p-6">
      <StaticSkeleton className="h-8 w-40" />
      <StaticSkeleton className="mt-2 h-4 w-full max-w-lg" />

      <div className="mt-6 overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827] p-6 text-white shadow-[var(--shadow-floating)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <StaticSkeleton className="h-4 w-32 rounded-lg bg-white/10" />
            <StaticSkeleton className="h-10 w-52 rounded-xl bg-white/10" />
            <StaticSkeleton className="h-5 w-24 rounded-lg bg-white/10" />
            <StaticSkeleton className="h-4 w-full max-w-xl rounded-lg bg-white/10" />
          </div>
          <StaticSkeleton className="h-28 w-28 shrink-0 rounded-3xl bg-white/10" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <StaticSkeleton className="h-4 w-16 rounded-lg bg-white/10" />
              <StaticSkeleton className="mt-2 h-6 w-36 rounded-lg bg-white/10" />
            </div>
            <div className="w-40">
              <StaticSkeleton className="ml-auto h-4 w-16 rounded-lg bg-white/10" />
              <StaticSkeleton className="mt-2 ml-auto h-6 w-full rounded-lg bg-white/10" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <StaticSkeleton className="h-2 w-full rounded-full bg-white/10" />
          <StaticSkeleton className="mt-3 h-4 w-28 rounded-lg bg-white/10" />
        </div>

        <div className="mt-6 flex justify-end">
          <StaticSkeleton className="h-14 w-36 rounded-full bg-white/10" />
        </div>
      </div>
    </Card>
  );
}

function SuggestGuideSkeleton() {
  return (
    <Card padding="md" tone="muted" className="space-y-4">
      <div className="grid gap-2">
        <StaticSkeleton className="h-4 w-20 rounded-lg" />
        <StaticSkeleton className="h-6 w-28" />
        <StaticSkeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[var(--radius-card)] border border-border/70 bg-surface-inset/80 p-4">
            <StaticSkeleton className="h-5 w-20" />
            <StaticSkeleton className="mt-2 h-4 w-full" />
            <StaticSkeleton className="mt-2 h-4 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <div className="space-y-6">
            <HeroSkeleton />

            <section className="rounded-[var(--radius-panel)] border border-border/70 bg-surface-overlay px-5 py-5 shadow-[var(--shadow-flat)] backdrop-blur-md sm:px-6 sm:py-6">
              <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="flex items-start gap-3">
                  <StaticSkeleton className="h-12 w-12 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <StaticSkeleton className="h-6 w-48" />
                    <StaticSkeleton className="mt-2 h-4 w-full max-w-lg" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <StaticSkeleton className="h-12 w-32 rounded-full" />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-6">
              <SectionHeadingSkeleton
                eyebrowWidth="w-16"
                titleWidth="w-40"
                descriptionWidth="max-w-md"
              />
              <FilterBarSkeleton />
            </section>

            <section>
              <div className="grid justify-items-center gap-x-4 gap-y-6 sm:grid-cols-2 sm:justify-items-stretch xl:grid-cols-3 xl:gap-x-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <PartnerCardSkeleton key={index} />
                ))}
              </div>
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function AuthPageSkeleton() {
  return <AuthLoginPageSkeleton />;
}

export function AuthLoginPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <AuthCardSkeleton />
        </Container>
      </main>
    </div>
  );
}

export function AuthResetPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <AuthCardSkeleton fieldCount={1} secondaryAction titleWidth="w-44" />
        </Container>
      </main>
    </div>
  );
}

export function AuthChangePasswordPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <AuthCardSkeleton fieldCount={2} secondaryAction={false} titleWidth="w-40" />
        </Container>
      </main>
    </div>
  );
}

export function AuthSignupPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-2xl p-6 sm:p-8">
            <div className="grid gap-2">
              <StaticSkeleton className="h-4 w-24 rounded-lg" />
              <StaticSkeleton className="h-8 w-36" />
              <StaticSkeleton className="h-4 w-full max-w-lg" />
              <StaticSkeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthFieldRowSkeleton labelWidth="w-24" />
                <AuthFieldRowSkeleton labelWidth="w-24" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthFieldRowSkeleton labelWidth="w-20" />
                <AuthFieldRowSkeleton labelWidth="w-20" />
              </div>
              <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset/70 p-4">
                <StaticSkeleton className="h-4 w-28 rounded-lg" />
                <StaticSkeleton className="h-12 w-full rounded-2xl" />
                <StaticSkeleton className="h-12 w-full rounded-2xl" />
                <StaticSkeleton className="h-12 w-full rounded-2xl" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <StaticSkeleton className="h-12 w-40 rounded-full" />
                <StaticSkeleton className="h-12 w-32 rounded-full" />
              </div>
            </div>
          </Card>
        </Container>
      </main>
    </div>
  );
}

export function AuthConsentPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-2xl p-6 sm:p-8">
            <div className="grid gap-2">
              <StaticSkeleton className="h-4 w-24 rounded-lg" />
              <StaticSkeleton className="h-8 w-32" />
              <StaticSkeleton className="h-4 w-full max-w-2xl" />
              <StaticSkeleton className="h-4 w-full max-w-lg" />
            </div>

            <div className="mt-6 grid gap-3">
              <StaticSkeleton className="h-12 w-full rounded-full" />
              {Array.from({ length: 3 }).map((_, index) => (
                <ConsentPolicyRowSkeleton key={index} />
              ))}
            </div>

            <div className="mt-6 grid gap-3">
              <StaticSkeleton className="h-12 w-full rounded-full" />
              <StaticSkeleton className="h-12 w-full rounded-full" />
            </div>
          </Card>
        </Container>
      </main>
    </div>
  );
}

export function NotificationsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
            <div className="px-1">
              <StaticSkeleton className="h-5 w-20 rounded-lg" />
            </div>

            <Card padding="none" className="mx-auto w-full max-w-3xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <StaticSkeleton className="h-5 w-24" />
                </div>
                <StaticSkeleton className="h-7 w-20 rounded-full" />
              </div>

              <div className="divide-y divide-border/70">
                {Array.from({ length: 4 }).map((_, index) => (
                  <NotificationItemSkeleton key={index} />
                ))}
              </div>
            </Card>

            <section className="space-y-2">
              <Card tone="default" padding="md" className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
                  <div className="min-w-0 space-y-1">
                    <StaticSkeleton className="h-6 w-28" />
                    <StaticSkeleton className="h-4 w-full max-w-md" />
                  </div>
                  <StaticSkeleton className="h-7 w-20 rounded-full" />
                </div>

                <StaticSkeleton className="h-20 w-full rounded-2xl" />

                <div className="space-y-3">
                  <StaticSkeleton className="h-4 w-24 rounded-lg" />
                  <div className="grid gap-3">
                    <StaticSkeleton className="h-14 w-full rounded-2xl" />
                    <StaticSkeleton className="h-14 w-full rounded-2xl" />
                    <StaticSkeleton className="h-14 w-full rounded-2xl" />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border bg-surface-inset p-4">
                  <StaticSkeleton className="h-5 w-28" />
                  <StaticSkeleton className="h-4 w-full max-w-lg" />
                  <StaticSkeleton className="h-4 w-full max-w-md" />
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-border bg-surface-inset p-4">
                    <StaticSkeleton className="h-5 w-28" />
                    <StaticSkeleton className="mt-2 h-4 w-full max-w-md" />
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <StaticSkeleton className="h-12 w-40 rounded-full" />
                      <StaticSkeleton className="h-12 w-36 rounded-full" />
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <StaticSkeleton className="h-5 w-20" />
                    <StaticSkeleton className="h-12 w-36 rounded-full" />
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-inset p-4"
                      >
                        <StaticSkeleton className="h-5 w-24" />
                        <StaticSkeleton className="h-7 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function CertificationPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-4xl space-y-6">
            <Card className="mx-auto max-w-2xl p-6 sm:p-8">
              <SectionHeadingSkeleton
                eyebrowWidth="w-28"
                titleWidth="w-44"
                descriptionWidth="max-w-lg"
              />
            </Card>

            <CertificationFrameSkeleton />

            <div className="mx-auto mt-4 w-full max-w-2xl rounded-3xl border border-border bg-surface-inset p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <StaticSkeleton className="h-5 w-24" />
                  <StaticSkeleton className="mt-2 h-4 w-full max-w-sm" />
                </div>
                <div className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                  <StaticSkeleton className="h-12 w-36 rounded-full" />
                  <StaticSkeleton className="h-12 w-28 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function SuggestPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto max-w-5xl space-y-5">
            <Card tone="default" padding="md" className="space-y-3">
              <SectionHeadingSkeleton
                eyebrowWidth="w-24"
                titleWidth="w-40"
                descriptionWidth="max-w-2xl"
              />
            </Card>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <Card padding="md">
                <div className="grid gap-6">
                  <StaticSkeleton className="h-16 w-full rounded-3xl" />
                  {Array.from({ length: 2 }).map((_, sectionIndex) => (
                    <div
                      key={sectionIndex}
                      className="grid gap-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0"
                    >
                      <StaticSkeleton className="h-6 w-28" />
                      <StaticSkeleton className="h-4 w-full max-w-md" />
                      <StaticSkeleton className="h-12 w-full rounded-2xl" />
                      <StaticSkeleton className="h-28 w-full rounded-2xl" />
                    </div>
                  ))}
                  <div className="rounded-3xl border border-border/70 bg-surface-inset p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <StaticSkeleton className="h-4 w-full max-w-sm" />
                      <StaticSkeleton className="h-12 w-32 rounded-full" />
                    </div>
                  </div>
                </div>
              </Card>

              <SuggestGuideSkeleton />
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function CampusPageSkeleton() {
  return <HomePageSkeleton />;
}

export function BugReportPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto max-w-3xl space-y-5">
            <Card tone="default" padding="md" className="space-y-3">
              <SectionHeadingSkeleton
                eyebrowWidth="w-24"
                titleWidth="w-40"
                descriptionWidth="max-w-2xl"
              />
            </Card>

            <Card tone="elevated" padding="md" className="space-y-4">
              <StaticSkeleton className="h-6 w-32 rounded-lg" />
              <StaticSkeleton className="h-4 w-full max-w-lg" />
              <StaticSkeleton className="h-32 w-full rounded-3xl" />
              <div className="flex flex-wrap justify-end gap-2">
                <StaticSkeleton className="h-12 w-36 rounded-full" />
              </div>
            </Card>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function CertificationVerifyPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingHeader />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto max-w-4xl space-y-6">
            <Card className="mx-auto max-w-2xl p-6 sm:p-8">
              <SectionHeadingSkeleton
                eyebrowWidth="w-32"
                titleWidth="w-48"
                descriptionWidth="max-w-lg"
              />
            </Card>

            <div className="flex justify-end">
              <StaticSkeleton className="h-8 w-28 rounded-full" />
            </div>

            <CertificationFrameSkeleton />

            <div className="flex justify-end">
              <StaticSkeleton className="h-12 w-24 rounded-full" />
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
