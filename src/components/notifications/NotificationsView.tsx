import NotificationInbox from "@/components/notifications/NotificationInbox";
import PushSettingsCard, {
  type PushSettingsCardProps,
} from "@/components/push/PushSettingsCard";
import Container from "@/components/ui/Container";
import type { NotificationListResult } from "@/lib/notifications/shared";

export default function NotificationsView({
  notifications,
  pushSettings,
}: {
  notifications: NotificationListResult;
  pushSettings: PushSettingsCardProps;
}) {
  return (
    <main>
      <Container className="pb-16 pt-8 sm:pt-10" size="wide">
        <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
          <div className="min-w-0 px-1">
            <h1 className="text-ko-title text-base font-semibold text-foreground sm:text-lg">
              알림
            </h1>
          </div>
          <NotificationInbox initialState={notifications} />
          <section className="space-y-2" aria-label="알림 수신 설정">
            <PushSettingsCard {...pushSettings} />
          </section>
        </div>
      </Container>
    </main>
  );
}
