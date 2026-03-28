import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import PushSettingsCard from "@/components/push/PushSettingsCard";
import Container from "@/components/ui/Container";
import { getMemberPushPreferences, isPushConfigured } from "@/lib/push";
import { getUserSession } from "@/lib/user-auth";

export const metadata = {
  title: "알림 설정 | SSARTNERSHIP",
};

export default async function NotificationsPage() {
  const session = await getUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }

  const pushPreferences = await getMemberPushPreferences(session.userId);
  const headerSession = { userId: session.userId };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-2xl">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">알림 설정</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                기기별 푸시 알림 수신 여부와 세부 알림 항목을 관리합니다.
              </p>
            </div>
            <PushSettingsCard
              initialPreferences={pushPreferences}
              configured={isPushConfigured()}
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
