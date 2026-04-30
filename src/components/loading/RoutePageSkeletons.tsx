import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Skeleton from "@/components/ui/Skeleton";

function LoadingTopBar({ actionCount = 3 }: { actionCount?: number }) {
  return (
    <div className="border-b border-border/70 bg-surface-overlay/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-3 py-4" size="wide">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-10 w-28 rounded-full sm:block" />
          {Array.from({ length: actionCount }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </Container>
    </div>
  );
}

function TextStack({
  eyebrowWidth = "w-20",
  titleWidth = "w-56",
  descriptionWidth = "max-w-2xl",
}: {
  eyebrowWidth?: string;
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <div className="grid gap-2">
      <Skeleton className={`h-4 ${eyebrowWidth} rounded-lg`} />
      <Skeleton className={`h-8 ${titleWidth} rounded-xl`} />
      <Skeleton className={`h-4 w-full ${descriptionWidth}`} />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

function MetricTileSkeleton() {
  return (
    <div className="rounded-[1rem] border border-border/80 bg-surface p-4 shadow-flat">
      <Skeleton className="h-4 w-16 rounded-lg" />
      <Skeleton className="mt-2 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-full max-w-[12rem]" />
    </div>
  );
}

function MetricRowSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <MetricTileSkeleton key={index} />
      ))}
    </div>
  );
}

function CenteredAuthCardSkeleton({
  titleWidth = "w-32",
  descriptionWidth = "max-w-sm",
  fieldCount = 2,
  secondaryAction = true,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  fieldCount?: number;
  secondaryAction?: boolean;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(28rem,0.5fr)] xl:items-start">
      <Card tone="default" className="space-y-4 p-6 sm:p-8">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </Card>
      <Card tone="elevated" className="space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className={`h-8 ${titleWidth}`} />
          <Skeleton className={`h-4 w-full ${descriptionWidth}`} />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: fieldCount }).map((_, index) => (
            <div key={index} className="grid gap-2">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ))}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-12 w-40 rounded-full" />
            {secondaryAction ? <Skeleton className="h-12 w-32 rounded-full" /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

function PartnerSetupHeroSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface-elevated p-6 shadow-floating backdrop-blur md:p-8">
      <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-36 rounded-lg" />
            <Skeleton className="h-12 w-full max-w-2xl" />
            <Skeleton className="h-4 w-full max-w-3xl" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
        <Card className="space-y-4 border-border/80 bg-surface-inset/90 p-5 shadow-flat">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-lg" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-border bg-surface-inset p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function PartnerDetailMediaSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="mt-6 space-y-3">
          <Skeleton className="h-12 w-full max-w-2xl" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-[2rem]" />
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        </div>
      </Card>
      <Skeleton className="order-2 h-[28rem] w-full rounded-[2rem] border border-border bg-surface-muted xl:order-2" />
    </div>
  );
}

function PartnerReviewSectionSkeleton() {
  return (
    <Card className="space-y-4 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-12 w-36 rounded-full" />
      </div>
      <Card padding="md" tone="muted" className="space-y-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </Card>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-surface-inset px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
            <Skeleton className="mt-2 h-4 w-full max-w-xl" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function GlobalRouteSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-40">
        <LoadingTopBar actionCount={3} />
      </header>
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="rounded-panel border border-border/70 bg-surface-overlay px-5 py-5 shadow-flat backdrop-blur-md sm:px-6 sm:py-6">
              <Skeleton className="h-4 w-28 rounded-lg" />
              <Skeleton className="mt-3 h-9 w-44" />
              <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
              <Skeleton className="mt-2 h-4 w-full max-w-xl" />
            </div>

            <Card className="space-y-4 p-6">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-border bg-surface-inset p-4"
                  >
                    <Skeleton className="h-4 w-16 rounded-lg" />
                    <Skeleton className="mt-3 h-8 w-24" />
                    <Skeleton className="mt-2 h-4 w-full max-w-[12rem]" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Container>
      </main>
    </div>
  );
}

export function PartnerPortalRouteSkeleton() {
  return (
    <Container size="wide" className="pb-16 pt-8 lg:pt-10">
      <div className="space-y-6">
        <Card tone="default" padding="md" className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </Card>

        <Card tone="default" padding="md" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-8 w-60" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <MetricRowSkeleton count={5} />
        </Card>

        <Card tone="default" padding="md" className="space-y-4">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-card border border-border/80 bg-surface-overlay p-5 shadow-flat"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20 rounded-lg" />
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Container>
  );
}

export function PublicPartnerDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-40">
        <LoadingTopBar actionCount={3} />
      </header>
      <main>
        <Container className="pb-16 pt-10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-12 w-28 rounded-full" />
            </div>
            <PartnerDetailMediaSkeleton />
            <Card className="space-y-4 p-6 sm:p-8">
              <Skeleton className="h-6 w-28" />
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            </Card>
            <PartnerReviewSectionSkeleton />
          </div>
        </Container>
      </main>
    </div>
  );
}

export function PartnerLoginSkeleton() {
  return (
    <Container size="wide" className="pb-16 pt-8 lg:pt-10">
      <CenteredAuthCardSkeleton
        titleWidth="w-40"
        descriptionWidth="max-w-md"
        fieldCount={2}
        secondaryAction
      />
    </Container>
  );
}

export function PartnerPasswordResetSkeleton() {
  return (
    <Container size="wide" className="pb-16 pt-8 lg:pt-10">
      <CenteredAuthCardSkeleton
        titleWidth="w-44"
        descriptionWidth="max-w-md"
        fieldCount={1}
        secondaryAction
      />
    </Container>
  );
}

export function PartnerPasswordChangeSkeleton() {
  return (
    <Container size="wide" className="pb-16 pt-8 lg:pt-10">
      <CenteredAuthCardSkeleton
        titleWidth="w-40"
        descriptionWidth="max-w-md"
        fieldCount={2}
        secondaryAction={false}
      />
    </Container>
  );
}

export function PartnerSupportSkeleton() {
  return (
    <Container size="wide" className="pb-16 pt-8 lg:pt-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Card tone="default" padding="md" className="space-y-4">
          <TextStack eyebrowWidth="w-24" titleWidth="w-32" descriptionWidth="max-w-xl" />
        </Card>
        <Card tone="default" padding="md" className="space-y-4">
          <Skeleton className="h-4 w-28 rounded-lg" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <div className="flex flex-wrap justify-end gap-2">
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
        </Card>
      </div>
    </Container>
  );
}

export function PartnerSetupIndexSkeleton() {
  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="space-y-8">
          <PartnerSetupHeroSkeleton />
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full max-w-sm" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full max-w-lg" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-12 w-36 rounded-full" />
                  <Skeleton className="h-12 w-28 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}

export function PartnerSetupPageSkeleton() {
  return (
    <div className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)]" />
      <Container size="wide" className="relative pb-16 pt-8 lg:pt-10">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(28rem,0.5fr)] xl:items-start">
          <PartnerSetupHeroSkeleton />
          <Card className="space-y-4 xl:sticky xl:top-6">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-4 w-full max-w-md" />
              <div className="grid gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="grid gap-2">
                    <Skeleton className="h-4 w-24 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Skeleton className="h-12 w-40 rounded-full" />
                <Skeleton className="h-12 w-32 rounded-full" />
              </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}

export function PartnerServiceDetailSkeleton() {
  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-36 rounded-full" />
          </div>

          <Card className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          </Card>

          <Card className="space-y-4 p-6 sm:p-8">
            <Skeleton className="h-6 w-32" />
            <MetricRowSkeleton count={7} />
          </Card>

          <Card className="space-y-4 p-6 sm:p-8">
            <TextStack eyebrowWidth="w-24" titleWidth="w-40" descriptionWidth="max-w-xl" />
            <Skeleton className="h-72 w-full rounded-[2rem]" />
          </Card>

          <Card className="space-y-4 p-6 sm:p-8">
            <Skeleton className="h-6 w-28" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-border bg-surface-inset p-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="mt-2 h-4 w-full max-w-md" />
                  <Skeleton className="mt-2 h-4 w-full max-w-sm" />
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card className="space-y-4 p-6 sm:p-8">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-32 w-full rounded-[2rem]" />
              <Skeleton className="h-32 w-full rounded-[2rem]" />
            </Card>
            <Skeleton className="h-[28rem] w-full rounded-[2rem] border border-border bg-surface-muted" />
          </div>

          <PartnerReviewSectionSkeleton />
        </div>
      </Container>
    </div>
  );
}

export function LegalRouteSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-surface-overlay/90 backdrop-blur">
        <LoadingTopBar actionCount={3} />
      </header>

      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>

            <Card tone="elevated" className="space-y-6 p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>

              <div className="space-y-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <section key={index} className="space-y-3">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full max-w-[92%]" />
                    <Skeleton className="h-4 w-full max-w-[88%]" />
                  </section>
                ))}
              </div>
            </Card>

            <Card className="space-y-4 p-5">
              <Skeleton className="h-5 w-28" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-border bg-surface-inset p-4"
                  >
                    <Skeleton className="h-4 w-20 rounded-lg" />
                    <Skeleton className="mt-3 h-6 w-28" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Container>
      </main>
    </div>
  );
}
