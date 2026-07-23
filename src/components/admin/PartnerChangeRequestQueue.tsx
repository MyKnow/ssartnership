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
}: {
  request: PartnerChangeRequestSummary;
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
  canReview: boolean;
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
        <Button href={`/admin/partners/${request.partnerId}`} variant="secondary">
          제휴처 상세
        </Button>
        {canReview ? (
          <div className="flex flex-wrap gap-2">
            <form action={rejectAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <SubmitButton variant="danger" pendingText="거절 중">
                거절
              </SubmitButton>
            </form>
            <form action={approveAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <SubmitButton pendingText="승인 중">승인</SubmitButton>
            </form>
          </div>
        ) : null}
      </div>
      </Surface>
    </article>
  );
}

export default function PartnerChangeRequestQueue({
  requests,
  approveAction,
  rejectAction,
  canReview,
}: {
  requests: PartnerChangeRequestSummary[];
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
  canReview: boolean;
}) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <AdminSectionHeading
        title="승인 대기 요청"
        description="변경된 항목만 현재값과 요청값으로 비교한 뒤 승인하거나 거절합니다."
      />

      {requests.length === 0 ? (
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
          {requests.map((request) => (
            <PartnerChangeRequestCard
              key={request.id}
              request={request}
              approveAction={approveAction}
              rejectAction={rejectAction}
              canReview={canReview}
            />
          ))}
        </div>
      )}
    </section>
  );
}
