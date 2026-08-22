"use client";

import { useEffect, useState } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import type {
  AdminReviewRecord,
  AdminReviewSummary,
} from "@/lib/admin-reviews";
import { formatPartnerReviewDate } from "@/components/partner-reviews/helpers";
import AdminReviewImageGallery from "./AdminReviewImageGallery";

type AdminReviewFormAction = (
  formData: FormData,
) => void | Promise<void>;

function hasReviewDetail(
  review: AdminReviewSummary | AdminReviewRecord,
): review is AdminReviewRecord {
  return "body" in review && typeof review.body === "string";
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="ui-caption">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function AdminReviewDetailDisclosure({
  review,
  returnTo,
  editable,
  updateAction,
}: {
  review: AdminReviewSummary | AdminReviewRecord;
  returnTo: string;
  editable: boolean;
  updateAction: AdminReviewFormAction;
}) {
  const initialDetail = hasReviewDetail(review) ? review : null;
  const [detail, setDetail] = useState<AdminReviewRecord | null>(initialDetail);
  const [detailState, setDetailState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >(initialDetail ? "loaded" : "idle");
  const [isOpen, setIsOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (!isOpen || detail) {
      return;
    }

    const controller = new AbortController();
    void fetch(`/api/admin/reviews/${encodeURIComponent(review.id)}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | AdminReviewRecord
          | null;
        return response.ok &&
          payload &&
          typeof payload.body === "string" &&
          Array.isArray(payload.images)
          ? payload
          : null;
      })
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!payload) {
          setDetailState("error");
          return;
        }
        setDetail(payload);
        setDetailState("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailState("error");
        }
      });

    return () => controller.abort();
  }, [detail, isOpen, requestKey, review.id]);

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setIsOpen(open);
        if (open && !detail) {
          setDetailState("loading");
        }
      }}
      className="min-w-0 rounded-control border border-border bg-surface-muted/60 p-3"
    >
      <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2">
        리뷰 내용·작성자 정보
      </summary>

      {detail ? (
        <div className="mt-3 grid min-w-0 gap-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
            {detail.body}
          </p>

          {editable ? (
            <details className="rounded-control border border-border bg-surface-muted/60 p-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                리뷰 수정
              </summary>
              <form action={updateAction} className="mt-3 grid gap-3">
                <input type="hidden" name="reviewId" value={detail.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    별점
                    <Select name="rating" defaultValue={String(detail.rating)}>
                      <option value="5">5점</option>
                      <option value="4">4점</option>
                      <option value="3">3점</option>
                      <option value="2">2점</option>
                      <option value="1">1점</option>
                    </Select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    제목
                    <Input name="title" defaultValue={detail.title} maxLength={80} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  내용
                  <Textarea
                    name="body"
                    defaultValue={detail.body}
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

          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem
              label="상태"
              value={detail.isHidden ? "비공개 처리" : "공개 중"}
            />
            <MetaItem
              label="작성자"
              value={`${detail.memberName} · ${detail.memberId}`}
            />
            <MetaItem label="MM" value={detail.memberUsername ?? "미등록"} />
            <MetaItem label="캠퍼스" value={detail.memberCampus ?? "미상"} />
            <MetaItem label="파트너사" value={detail.companyName ?? "미상"} />
            <MetaItem label="제휴처" value={detail.partnerName} />
            <MetaItem
              label="작성"
              value={formatPartnerReviewDate(detail.createdAt)}
            />
            <MetaItem
              label="수정"
              value={formatPartnerReviewDate(detail.updatedAt)}
            />
          </dl>

          <AdminReviewImageGallery images={detail.images} />
        </div>
      ) : detailState === "error" ? (
        <div className="mt-3 grid gap-3" role="alert">
          <p className="text-sm text-muted-foreground">
            리뷰 상세를 불러오지 못했습니다. 목록은 계속 사용할 수 있습니다.
          </p>
          <button
            type="button"
            className="min-h-11 w-fit rounded-control border border-border px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => {
              setDetailState("loading");
              setRequestKey((current) => current + 1);
            }}
          >
            다시 불러오기
          </button>
        </div>
      ) : detailState === "loading" ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          리뷰 상세를 불러오는 중입니다.
        </p>
      ) : null}
    </details>
  );
}
