import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Skeleton from "@/components/ui/Skeleton";

function HomePartnerCardSkeleton() {
  return (
    <article className="flex h-full w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex gap-4">
        <Skeleton className="aspect-square w-28 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Skeleton className="h-6 w-36 max-w-[70%]" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full max-w-[85%]" />
          <Skeleton className="mt-2 h-4 w-40 max-w-[60%]" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-28 rounded-full" />
      </div>
    </article>
  );
}

function AuthCardFrame({
  titleWidth = "w-28",
  fieldCount = 2,
  secondaryButton = true,
}: {
  titleWidth?: string;
  fieldCount?: number;
  secondaryButton?: boolean;
}) {
  return (
    <Card className="mx-auto max-w-lg p-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-3 h-4 w-full max-w-sm" />
      <div className="mt-6 flex flex-col gap-4">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}
        <Skeleton className={`h-12 ${titleWidth} rounded-full`} />
        {secondaryButton ? (
          <Skeleton className="h-12 w-32 rounded-full" />
        ) : null}
      </div>
    </Card>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <section className="hero-surface rounded-3xl px-8 py-10 shadow-lg">
            <Skeleton className="h-4 w-40 rounded-lg bg-white/15 dark:bg-white/10" />
            <Skeleton className="mt-4 h-10 w-full max-w-xl rounded-xl bg-white/15 dark:bg-white/10" />
            <Skeleton className="mt-4 h-4 w-full max-w-2xl rounded-lg bg-white/15 dark:bg-white/10" />
            <Skeleton className="mt-2 h-4 w-full max-w-xl rounded-lg bg-white/15 dark:bg-white/10" />
          </section>

          <section className="mt-6 rounded-[28px] border border-border bg-surface-elevated p-5 shadow-md">
            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="mt-2 h-4 w-full max-w-lg" />
                </div>
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-12 w-32 rounded-full" />
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-col gap-6">
            <div>
              <Skeleton className="h-8 w-36" />
              <Skeleton className="mt-2 h-4 w-full max-w-md" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-12 w-24 rounded-full"
                  />
                ))}
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <Skeleton className="h-4 w-10 rounded-lg" />
                  <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
                </div>
                <div className="md:w-56">
                  <Skeleton className="h-4 w-36 rounded-lg" />
                  <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="grid justify-items-center gap-x-4 gap-y-6 sm:grid-cols-2 sm:justify-items-stretch xl:grid-cols-3 xl:gap-x-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <HomePartnerCardSkeleton key={index} />
              ))}
            </div>
          </section>
        </Container>
      </main>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <AuthCardFrame />
        </Container>
      </main>
    </div>
  );
}

export function NotificationsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-2xl">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />

            <Card className="mt-6 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="mt-2 h-4 w-full max-w-lg" />
                </div>
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-surface-muted p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-3 h-4 w-full max-w-xl" />
                <Skeleton className="mt-2 h-4 w-full max-w-lg" />
              </div>

              <div className="mt-6 grid gap-3">
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-12 w-36 rounded-full" />
                  <Skeleton className="h-12 w-40 rounded-full" />
                </div>
                <div className="grid gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
                      </div>
                      <Skeleton className="h-8 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function CertificationPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-2xl p-6">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="mt-2 h-4 w-full max-w-lg" />

            <div className="mt-6 relative overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827] p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.5)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-32 rounded-lg bg-white/10" />
                  <Skeleton className="mt-3 h-10 w-32 rounded-xl bg-white/10" />
                  <Skeleton className="mt-2 h-5 w-24 rounded-lg bg-white/10" />
                </div>
                <Skeleton className="h-28 w-28 shrink-0 rounded-3xl bg-white/10" />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-16 rounded-lg bg-white/10" />
                    <Skeleton className="mt-2 h-6 w-36 rounded-lg bg-white/10" />
                  </div>
                  <div className="w-40">
                    <Skeleton className="ml-auto h-4 w-16 rounded-lg bg-white/10" />
                    <Skeleton className="mt-2 ml-auto h-6 w-full rounded-lg bg-white/10" />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Skeleton className="h-2 w-full rounded-full bg-white/10" />
                <Skeleton className="mt-3 h-4 w-28 rounded-lg bg-white/10" />
              </div>

              <div className="mt-6 flex justify-end">
                <Skeleton className="h-14 w-36 rounded-full bg-white/10" />
              </div>
            </div>
          </Card>

          <div className="mx-auto mt-4 w-full max-w-2xl rounded-3xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-2 h-4 w-full max-w-sm" />
              </div>
              <div className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                <Skeleton className="h-12 w-36 rounded-full" />
                <Skeleton className="h-12 w-28 rounded-full" />
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
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
          <Card className="mt-6">
            <div className="grid gap-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-1">
                  <Skeleton className="h-4 w-20 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Skeleton className="h-4 w-24 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
                <div className="grid gap-1">
                  <Skeleton className="h-4 w-24 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-12 w-32 rounded-full" />
              </div>
            </div>
          </Card>
        </Container>
      </main>
    </div>
  );
}
