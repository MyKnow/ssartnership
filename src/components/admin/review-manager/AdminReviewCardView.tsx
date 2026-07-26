import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import type { AdminReviewRecord } from "@/lib/admin-reviews";
import { formatPartnerReviewDate } from "@/components/partner-reviews/helpers";
import { cn } from "@/lib/cn";
import AdminReviewImageGallery from "./AdminReviewImageGallery";

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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="ui-caption">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
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
  review: AdminReviewRecord;
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

      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
        {review.body}
      </p>

      {editable && canUpdate ? (
        <details className="rounded-xl border border-border bg-surface-muted/60 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            리뷰 수정
          </summary>
          <form action={updateAction} className="mt-3 grid gap-3">
            <input type="hidden" name="reviewId" value={review.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                별점
                <Select name="rating" defaultValue={String(review.rating)}>
                  <option value="5">5점</option>
                  <option value="4">4점</option>
                  <option value="3">3점</option>
                  <option value="2">2점</option>
                  <option value="1">1점</option>
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                제목
                <Input
                  name="title"
                  defaultValue={review.title}
                  maxLength={80}
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              내용
              <Textarea
                name="body"
                defaultValue={review.body}
                rows={4}
                maxLength={1000}
              />
            </label>
            <div className="flex justify-end">
              <SubmitButton variant="secondary" pendingText="수정 중">
                리뷰 수정
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : null}

      <details className="group min-w-0 rounded-xl border border-border bg-surface-muted/60">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span>작성자·운영 정보</span>
          <span className="text-right text-xs font-normal leading-5 text-muted-foreground">
            {review.memberName} ·{" "}
            {review.imageCount > 0
              ? `사진 ${review.imageCount}장`
              : "사진 없음"}
          </span>
        </summary>
        <div className="grid min-w-0 gap-4 border-t border-border/70 p-3">
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem label="상태" value={hiddenReason} />
            <MetaItem
              label="작성자"
              value={`${review.memberName} · ${review.memberId}`}
            />
            <MetaItem label="MM" value={review.memberUsername ?? "미등록"} />
            <MetaItem label="캠퍼스" value={review.memberCampus ?? "미상"} />
            <MetaItem label="파트너사" value={review.companyName ?? "미상"} />
            <MetaItem label="제휴처" value={review.partnerName} />
            <MetaItem
              label="작성"
              value={formatPartnerReviewDate(review.createdAt)}
            />
            <MetaItem
              label="수정"
              value={formatPartnerReviewDate(review.updatedAt)}
            />
          </dl>

          <AdminReviewImageGallery images={review.images} />
        </div>
      </details>
    </Card>
  );
}
