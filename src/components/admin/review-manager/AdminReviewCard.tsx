import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminReviewRecord } from "@/lib/admin-reviews";
import { formatPartnerReviewDate } from "@/components/partner-reviews/helpers";
import { hidePartnerReview, restorePartnerReview } from "@/app/admin/(protected)/actions";
import { cn } from "@/lib/cn";
import AdminReviewImageGallery from "./AdminReviewImageGallery";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const value = index + 1;
        const Icon = value <= rating ? StarIconSolid : StarIconOutline;
        return (
          <Icon
            key={value}
            className={cn("h-4 w-4", value <= rating ? "text-amber-500" : "text-border-strong")}
          />
        );
      })}
    </div>
  );
}

export default function AdminReviewCard({
  review,
  returnTo,
}: {
  review: AdminReviewRecord;
  returnTo: string;
}) {
  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={review.isHidden ? "warning" : "success"}>
              {review.isHidden ? "비공개" : "공개"}
            </Badge>
            <Badge variant="neutral">{review.rating}점</Badge>
            <Badge variant="neutral">
              {review.imageCount > 0 ? `사진 ${review.imageCount}장` : "사진 없음"}
            </Badge>
            <Chip>
              {formatPartnerReviewDate(review.createdAt)}
            </Chip>
          </div>

          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              {review.companyName ?? "알 수 없는 협력사"} · {review.partnerName}
            </p>
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              {review.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {review.authorMaskedName} · {review.authorRoleLabel} · {review.memberUsername ?? "MM 미등록"} ·{" "}
              {review.memberCampus ?? "캠퍼스 미상"} · 작성 {formatPartnerReviewDate(review.createdAt)}
              {" · "}
              수정 {formatPartnerReviewDate(review.updatedAt)}
            </p>
          </div>
        </div>

        <div className="grid justify-items-end gap-2">
          {review.isHidden ? (
            <form action={restorePartnerReview}>
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="grid justify-items-end gap-2">
                <Badge variant="warning">비공개됨</Badge>
                <SubmitButton variant="secondary" pendingText="공개 복원 중" className="w-full sm:w-auto">
                  다시 공개
                </SubmitButton>
              </div>
            </form>
          ) : (
            <form action={hidePartnerReview}>
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SubmitButton variant="danger" pendingText="비공개 중" className="w-full sm:w-auto">
                비공개 처리
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StarRow rating={review.rating} />
        <div className="text-sm text-muted-foreground">
          작성자: {review.memberName} · {review.memberId}
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{review.body}</p>

      <div className="flex flex-wrap gap-2">
        <Chip>{review.partnerName}</Chip>
        {review.companyName ? <Chip>{review.companyName}</Chip> : null}
        <Chip>{review.memberName}</Chip>
        <Chip>{review.memberCampus ?? "캠퍼스 미상"}</Chip>
      </div>

      <AdminReviewImageGallery images={review.images} />
    </Card>
  );
}
