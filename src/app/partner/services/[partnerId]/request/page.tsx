import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner-session";

export const dynamic = "force-dynamic";

export default async function PartnerServiceRequestRedirectPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const { partnerId } = await params;
  redirect(`/partner/services/${encodeURIComponent(partnerId)}?mode=edit`);
}
