import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import PartnerReviewSection from "@/components/partner-reviews/PartnerReviewSection";
import { partnerReviewRepository } from "@/lib/repositories";

export function PartnerDetailReviewsFallback() {
  return (
    <Card className="grid gap-4 p-5">
      <div className="grid gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </Card>
  );
}

export default async function PartnerDetailReviews({
  partnerId,
  currentUserId,
}: {
  partnerId: string;
  currentUserId: string | null;
}) {
  const initialReviewData = await partnerReviewRepository.listPartnerReviews({
    partnerId,
    currentUserId,
    sort: "latest",
    offset: 0,
    limit: 10,
    includeHidden: false,
  });

  return (
    <PartnerReviewSection
      partnerId={partnerId}
      canWriteReview={Boolean(currentUserId)}
      initialSummary={initialReviewData.summary}
      initialReviews={initialReviewData.items}
      initialSort="latest"
      initialOffset={initialReviewData.nextOffset}
      initialHasMore={initialReviewData.hasMore}
    />
  );
}
