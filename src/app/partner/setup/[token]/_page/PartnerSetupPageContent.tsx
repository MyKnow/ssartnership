import Container from "@/components/ui/Container";
import PartnerSetupHero from "@/app/partner/setup/[token]/_page/PartnerSetupHero";
import {
  PartnerSetupCompanyCard,
  PartnerSetupFormPanel,
} from "@/app/partner/setup/[token]/_page/PartnerSetupCompanySection";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";

export default function PartnerSetupPageContent({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <div className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.92))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50 dark:bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] dark:opacity-20" />
      <Container size="wide" className="relative pb-16 pt-8 lg:pt-10">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] xl:items-start">
          <div className="grid min-w-0 gap-5">
            <PartnerSetupHero context={context} />
            <div className="hidden xl:block">
              <PartnerSetupCompanyCard context={context} />
            </div>
          </div>
          <div className="grid min-w-0 gap-5">
            <PartnerSetupFormPanel context={context} />
            <div className="xl:hidden">
              <PartnerSetupCompanyCard context={context} />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
