import type { Metadata } from "next";
import {
  createPartnerRegistrationExcelRequestAction,
  createPartnerRegistrationRequestAction,
} from "./actions";
import PartnerRegistrationClient from "@/components/partner-registration/PartnerRegistrationClient";
import PartnerRegistrationGuide from "@/components/partner-registration/PartnerRegistrationGuide";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `신규 파트너사 등록 | ${SITE_NAME}`,
  description:
    "SSARTNERSHIP 신규 파트너사 등록에 필요한 파트너사 정보를 단계별 등록 또는 파일 업로드로 접수합니다.",
  robots: {
    index: false,
    follow: true,
  },
};

export default async function PartnerRegistrationPage() {
  const [headerSession, categoriesResult] = await Promise.all([
    getHeaderSession(),
    getSupabaseAdminClient()
      .from("categories")
      .select("id,key,label")
      .order("created_at", { ascending: true }),
  ]);
  const categories = categoriesResult.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader suggestHref="/suggest" initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto grid max-w-6xl min-w-0 gap-5">
            <ShellHeader
              eyebrow="Partner Registration"
              title="신규 파트너사 등록"
              description="제휴처 유형을 선택하고 단계별 등록 또는 파일 업로드로 신규 파트너사 검토를 요청할 수 있습니다."
              className="px-5 py-5 sm:px-6 sm:py-6"
            />

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
              <PartnerRegistrationClient
                categories={categories}
                webAction={createPartnerRegistrationRequestAction}
                excelAction={createPartnerRegistrationExcelRequestAction}
              />
              <PartnerRegistrationGuide />
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
