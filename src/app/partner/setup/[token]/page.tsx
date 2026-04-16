import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerPortalSetupContext } from "@/lib/partner-auth";
import { SITE_NAME } from "@/lib/site";
import PartnerSetupPageContent from "@/app/partner/setup/[token]/_page/PartnerSetupPageContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const context = await getPartnerPortalSetupContext(token);

  if (!context) {
    return {
      title: `제휴 포털 초기 설정 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${context.company.name} 초기 설정 | ${SITE_NAME}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PartnerSetupTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getPartnerPortalSetupContext(token);
  if (!context) {
    notFound();
  }

  return <PartnerSetupPageContent context={context} />;
}
