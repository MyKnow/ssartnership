import { resolvePartnerAudienceFromMemberYear } from "@/lib/partner-audience";
import type { PartnerViewContext } from "@/lib/repositories/partner-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function getPartnerViewerContext(
  userId?: string | null,
): Promise<PartnerViewContext> {
  if (!userId) {
    return { authenticated: false };
  }

  const { data } = await getSupabaseAdminClient()
    .from("members")
    .select("year")
    .eq("id", userId)
    .maybeSingle();

  return {
    authenticated: true,
    viewerAudience: resolvePartnerAudienceFromMemberYear(
      typeof data?.year === "number" ? data.year : null,
    ),
  };
}
