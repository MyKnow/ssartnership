import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SubmitButton from "@/components/ui/SubmitButton";
import { formatPartnerReviewDate } from "@/components/partner-reviews/helpers";
import type {
  AdminReviewRecord,
  AdminReviewSummary,
} from "@/lib/admin-reviews";
import { cn } from "@/lib/cn";
import AdminReviewDetailDisclosure from "./AdminReviewDetailDisclosure";

export type AdminReviewFormAction = (
  formData: FormData,
) => void | Promise<void>;

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const value = index + 1;
        const Icon = value <= rating ? StarIconSolid : StarIconOutline;
        return (
          <Icon
            key={value}
            className={cn(
              "h-4 w-4",
              value <= rating ? "text-amber-500" : "text-border-strong",
            )}
          />
        );
      })}
    </div>
  );
}

export default function AdminReviewCardView({
  review,
  returnTo,
  editable = false,
  hideAction,
  restoreAction,
  updateAction,
  deleteAction,
  canUpdate = true,
  canDelete = true,
}: {
  review: AdminReviewSummary | AdminReviewRecord;
  returnTo: string;
  editable?: boolean;
  hideAction: AdminReviewFormAction;
  restoreAction: AdminReviewFormAction;
  updateAction: AdminReviewFormAction;
  deleteAction: AdminReviewFormAction;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const statusLabel = review.isHidden ? "비공개" : "공개";

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
              {review.imageCount > 0
                ? `사진 ${review.imageCount}장`
                : "사진 없음"}
            </Badge>
            <Badge variant="success">추천 {review.recommendCount}</Badge>
            <Badge variant="danger">비추천 {review.disrecommendCount}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatPartnerReviewDate(review.createdAt)}
            </span>
          </div>

          <div className="grid gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {review.companyName ?? "알 수 없는 파트너사"} ·{" "}
              {review.partnerName}
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

        {canUpdate || canDelete ? (
          <div className="grid min-w-[8rem] justify-items-stretch gap-2">
            {canUpdate ? (
              review.isHidden ? (
                <form action={restoreAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div className="grid justify-items-end gap-2">
                    <SubmitButton
                      variant="secondary"
                      pendingText="공개 복원 중"
                      className="w-full sm:w-auto"
                    >
                      다시 공개
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <form action={hideAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <SubmitButton
                    variant="danger"
                    pendingText="비공개 중"
                    className="w-full sm:w-auto"
                  >
                    비공개 처리
                  </SubmitButton>
                </form>
              )
            ) : null}
            {canDelete ? (
              <form action={deleteAction}>
                <input type="hidden" name="reviewId" value={review.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton
                  variant="danger"
                  pendingText="삭제 중"
                  className="w-full sm:w-auto"
                >
                  삭제
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="min-w-[12rem] max-w-sm rounded-control border border-border bg-surface-inset px-3 py-2 text-sm">
            <p className="font-semibold text-foreground">조회 전용 권한</p>
            <p className="mt-1 leading-5 text-muted-foreground">
              리뷰 내용과 공개 상태를 확인할 수 있지만 상태 변경과 삭제는 할 수
              없습니다.
            </p>
          </div>
        )}
      </div>

      <AdminReviewDetailDisclosure
        review={review}
        returnTo={returnTo}
        editable={editable && canUpdate}
        updateAction={updateAction}
      />
    </Card>
  );
}
