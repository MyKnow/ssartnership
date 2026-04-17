import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminReviewRecord } from "@/lib/admin-reviews";
import { formatPartnerReviewDate } from "@/components/partner-reviews/helpers";
import {
  deletePartnerReview,
  hidePartnerReview,
  restorePartnerReview,
} from "@/app/admin/(protected)/actions";
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

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="ui-caption">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
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
  const statusLabel = review.isHidden ? "비공개" : "공개";
  const hiddenReason = review.isHidden ? "비공개 처리" : "공개 중";

  return (
    <Card padding="md" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={review.isHidden ? "warning" : "success"}>
              {statusLabel}
            </Badge>
            <Badge variant="neutral">{review.rating}점</Badge>
            <Badge variant="neutral">
              {review.imageCount > 0 ? `사진 ${review.imageCount}장` : "사진 없음"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatPartnerReviewDate(review.createdAt)}
            </span>
          </div>

          <div className="grid gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {review.companyName ?? "알 수 없는 협력사"} · {review.partnerName}
            </p>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {review.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StarRow rating={review.rating} />
              <span>
                {review.authorMaskedName} · {review.authorRoleLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-[8rem] justify-items-stretch gap-2">
          {review.isHidden ? (
            <form action={restorePartnerReview}>
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="grid justify-items-end gap-2">
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
          <form action={deletePartnerReview}>
            <input type="hidden" name="reviewId" value={review.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <SubmitButton variant="danger" pendingText="삭제 중" className="w-full sm:w-auto">
              삭제
            </SubmitButton>
          </form>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{review.body}</p>

      <dl className="grid gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetaItem label="상태" value={hiddenReason} />
        <MetaItem label="작성자" value={`${review.memberName} · ${review.memberId}`} />
        <MetaItem label="MM" value={review.memberUsername ?? "미등록"} />
        <MetaItem label="캠퍼스" value={review.memberCampus ?? "미상"} />
        <MetaItem label="협력사" value={review.companyName ?? "미상"} />
        <MetaItem label="브랜드" value={review.partnerName} />
        <MetaItem label="작성" value={formatPartnerReviewDate(review.createdAt)} />
        <MetaItem label="수정" value={formatPartnerReviewDate(review.updatedAt)} />
      </dl>

      <AdminReviewImageGallery images={review.images} />
    </Card>
  );
}
