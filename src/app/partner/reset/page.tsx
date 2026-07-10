import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PartnerResetScreen from "@/components/partner/PartnerResetScreen";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `파트너 포털 비밀번호 재설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerPasswordResetPage() {
  const session = await getPartnerSession();
  if (session) {
    redirect(session.mustChangePassword ? "/partner/change-password" : "/partner");
  }

  return <PartnerResetScreen />;
}
