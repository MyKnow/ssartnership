import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import CertificationView from "@/components/certification/CertificationView";
import CertificationFooterActions from "@/components/certification/CertificationFooterActions";
import CertificationProfileSync from "@/components/certification/CertificationProfileSync";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `SSAFY 인증 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

type CertificationMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name?: string | null;
  year?: number | null;
  campus?: string | null;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
};

export default async function CertificationPage() {
  const initialTimestamp = new Date().toISOString();
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }

  const headerSession = session?.userId ? { userId: session.userId } : null;

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64",
    )
    .eq("id", session.userId)
    .maybeSingle();

  if (!member) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold text-foreground">
              SSAFY 인증
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              현재 계정의 인증 상태와 표시 정보를 확인합니다.
            </p>
            <CertificationView
              member={member as CertificationMember}
              initialTimestamp={initialTimestamp}
            />
          </div>
          <CertificationFooterActions />
          <CertificationProfileSync />
        </Container>
      </main>
    </div>
  );
}
