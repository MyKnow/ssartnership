import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import CertificationView from "@/components/certification/CertificationView";
import CertificationFooterActions from "@/components/certification/CertificationFooterActions";

export const metadata = {
  title: "교육생 인증 | SSARTNERSHIP",
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
      "id,mm_username,display_name,year,campus,class_number,avatar_content_type,avatar_base64",
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
          <Card className="mx-auto max-w-2xl p-6">
            <h1 className="text-2xl font-semibold text-foreground">
              교육생 인증
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Mattermost 인증 정보를 기반으로 SSAFY 교육생임을 확인합니다.
            </p>
            <CertificationView
              member={member}
              initialTimestamp={initialTimestamp}
            />
          </Card>
          <CertificationFooterActions />
        </Container>
      </main>
    </div>
  );
}
