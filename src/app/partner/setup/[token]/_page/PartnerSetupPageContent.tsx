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
    <div className="mx-auto flex w-full max-w-[32.5rem] flex-col gap-4 px-4 pb-16 pt-8 md:pt-12">
      <PartnerSetupHero context={context} />
      <PartnerSetupFormPanel context={context} />
      <PartnerSetupCompanyCard context={context} />
    </div>
  );
}
