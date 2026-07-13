import EventLanding from "@/components/events/EventLanding";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import type { EventCampaign } from "@/lib/promotions/catalog";
import type { EventRewardSummary } from "@/lib/promotions/event-rewards";

export type EventPageViewProps = {
  campaign: EventCampaign;
  summary: EventRewardSummary;
  showHeroImage: boolean;
  showRegistrationNotice: boolean;
  structuredData?: Record<string, unknown> | null;
};

export default function EventPageView({
  campaign,
  summary,
  showHeroImage,
  showRegistrationNotice,
  structuredData,
}: EventPageViewProps) {
  return (
    <main>
      <Container className="pb-16 pt-8 sm:pt-10" size="wide">
        {structuredData ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        ) : null}
        <EventLanding
          campaign={campaign}
          summary={summary}
          showHeroImage={showHeroImage}
        />
        {showRegistrationNotice ? (
          <Card tone="muted" padding="md" className="mt-5">
            <p className="text-sm text-muted-foreground">
              아직 운영 등록 전인 이벤트 페이지입니다. 관리 화면에서 기간과 대상을
              등록하면 공개 메타가 활성화됩니다.
            </p>
          </Card>
        ) : null}
      </Container>
    </main>
  );
}
