import HeroSection from "@/components/HeroSection";
import HomeView from "@/components/HomeView";
import Container from "@/components/ui/Container";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";
import type { Category, Partner } from "@/lib/types";

export type CampusLandingViewProps = {
  campus: {
    label: string;
    fullLabel: string;
    description: string;
  };
  publicPartnerCount: number;
  categories: Category[];
  partners: Partner[];
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  partnerPopularityById?: Record<string, PartnerPopularityMetrics | undefined>;
  partnerFavoriteStateById?: Record<string, boolean | undefined>;
  loadedPartnerStateIds?: string[];
  structuredData?: Record<string, unknown> | null;
};

export default function CampusLandingView({
  campus,
  publicPartnerCount,
  categories,
  partners,
  viewerAuthenticated,
  currentUserId,
  partnerPopularityById,
  partnerFavoriteStateById,
  loadedPartnerStateIds,
  structuredData,
}: CampusLandingViewProps) {
  return (
    <main>
      <Container className="pb-16 pt-10" size="wide">
        {structuredData ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        ) : null}
        <HeroSection
          eyebrow={`Campus · ${campus.label}`}
          title={`${campus.fullLabel} 제휴 혜택`}
          description={`${campus.description} 공개 제휴 ${publicPartnerCount}건을 기준으로 카테고리와 검색 필터를 바로 사용할 수 있습니다.`}
        />
        <HomeView
          categories={categories}
          partners={partners}
          viewerAuthenticated={viewerAuthenticated}
          currentUserId={currentUserId}
          partnerPopularityById={partnerPopularityById}
          partnerFavoriteStateById={partnerFavoriteStateById}
          loadedPartnerStateIds={loadedPartnerStateIds}
        />
      </Container>
    </main>
  );
}
