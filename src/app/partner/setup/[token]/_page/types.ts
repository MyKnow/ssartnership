import type { getPartnerPortalSetupContext } from "@/lib/partner-auth";

export type AwaitedPartnerSetupContext = NonNullable<
  Awaited<ReturnType<typeof getPartnerPortalSetupContext>>
>;
