import { resolvePartnerAudienceFromMemberYear } from "@/lib/partner-audience";
import { getMemberAudienceSnapshot } from "@/lib/member-audience-snapshot";
import type { PartnerViewContext } from "@/lib/repositories/partner-repository";

export async function getPartnerViewerContext(
  userId?: string | null,
): Promise<PartnerViewContext> {
  if (!userId) {
    return { authenticated: false };
  }

  const member = await getMemberAudienceSnapshot(userId);

  return {
    authenticated: true,
    viewerAudience: resolvePartnerAudienceFromMemberYear(
      member?.generation ?? null,
      new Date(),
      undefined,
      { graduateVerifiedAt: member?.graduateVerifiedAt ?? null },
    ),
  };
}
