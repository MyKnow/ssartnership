"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";
import { DiffCard } from "../partner-change-request-ui/DiffPrimitives";
import { buildPartnerChangeRequestDiffItems } from "../partner-change-request-ui/buildDiffItems";

function PartnerChangeRequestCard({
  request,
  approveAction,
  rejectAction,
  canReview,
  returnTo,
}: {
  request: PartnerChangeRequestSummary;
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
  canReview: boolean;
  returnTo: string;
}) {
  const diffItems = buildPartnerChangeRequestDiffItems(request);

  return (
    <article className="min-w-0">
      <Surface level="inset" padding="lg" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">승인 대기</Badge>
            <Badge className="bg-surface text-foreground">{request.companyName}</Badge>
            <Badge className="bg-surface text-foreground">{request.categoryLabel}</Badge>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{request.partnerName}</p>
            <p className="text-sm text-muted-foreground">{request.partnerLocation}</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            요청자{" "}
            <span className="font-medium text-foreground">
              {request.requestedByDisplayName ?? request.requestedByLoginId ?? "미지정"}
            </span>
          </p>
          <p className="mt-1">
            요청 시각 {formatKoreanDateTimeToMinute(request.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
        {diffItems.map((item) => (
          <div key={item.key} className="min-w-0">
            <DiffCard
              label={item.label}
              current={item.current}
              requested={item.requested}
            />
          </div>
        ))}
      </div>

      {diffItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-inset/85 px-4 py-3 text-sm text-muted-foreground">
          변경된 항목이 없습니다.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <Button
          href={`/admin/partners/${request.partnerId}?returnTo=${encodeURIComponent(returnTo)}`}
          variant="secondary"
        >
          제휴처 상세
        </Button>
        {canReview ? (
          <div className="flex flex-wrap gap-2">
            <form action={rejectAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SubmitButton variant="danger" pendingText="거절 중">
                거절
              </SubmitButton>
            </form>
            <form action={approveAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SubmitButton pendingText="승인 중">승인</SubmitButton>
            </form>
          </div>
        ) : null}
      </div>
      </Surface>
    </article>
  );
}

function buildQueuePageHref(returnTo: string, page: number) {
  const url = new URL(returnTo, "https://admin.local");
  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }
  return `${url.pathname}${url.search}`;
}

export default function PartnerChangeRequestQueue({
  requests,
  approveAction,
  rejectAction,
  canReview,
  returnTo = "/admin/partner-requests",
  pagination,
  loadError = false,
}: {
  requests: PartnerChangeRequestSummary[];
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
  canReview: boolean;
  returnTo?: string;
  pagination?: {
    totalCount: number;
    page: number;
    pageSize: number;
  };
  loadError?: boolean;
}) {
  const effectivePagination = pagination ?? {
    totalCount: requests.length,
    page: 1,
    pageSize: Math.max(1, requests.length),
  };
  const totalPages = Math.max(
    1,
    Math.ceil(effectivePagination.totalCount / effectivePagination.pageSize),
  );
  const currentPage = Math.min(effectivePagination.page, totalPages);
  const pageStart = (currentPage - 1) * effectivePagination.pageSize;

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <AdminSectionHeading
        title="승인 대기 요청"
        description="변경된 항목만 현재값과 요청값으로 비교한 뒤 승인하거나 거절합니다."
      />

      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="변경 요청을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
          action={<Button href={returnTo} variant="secondary">다시 확인</Button>}
        />
      ) : requests.length === 0 ? (
        <AdminStatePanel
          kind="empty"
          title="승인 대기 요청이 없습니다."
          description="파트너사 담당자가 민감 정보 변경 요청을 보내면 이곳에 표시됩니다."
          action={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록 보기
            </Button>
          }
        />
      ) : (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          {totalPages > 1 ? (
            <Surface level="inset" padding="sm" className="flex min-w-0 flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {pageStart + 1}-{Math.min(pageStart + requests.length, effectivePagination.totalCount)} / {effectivePagination.totalCount.toLocaleString("ko-KR")}
              </p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Button
                  href={buildQueuePageHref(returnTo, currentPage - 1)}
                  variant="secondary"
                  size="sm"
                  prefetch
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  href={buildQueuePageHref(returnTo, currentPage + 1)}
                  variant="secondary"
                  size="sm"
                  prefetch
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
              </div>
            </Surface>
          ) : null}
          {requests.map((request) => (
            <PartnerChangeRequestCard
              key={request.id}
              request={request}
              approveAction={approveAction}
              rejectAction={rejectAction}
              canReview={canReview}
              returnTo={returnTo}
            />
          ))}
        </div>
      )}
    </section>
  );
}
