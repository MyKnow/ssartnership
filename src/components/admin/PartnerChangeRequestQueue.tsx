"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";
import { DiffCard } from "../partner-change-request-ui/DiffPrimitives";
import { buildPartnerChangeRequestDiffItems } from "../partner-change-request-ui/buildDiffItems";

function PartnerChangeRequestCard({
  request,
  approveAction,
  rejectAction,
}: {
  request: PartnerChangeRequestSummary;
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
}) {
  const diffItems = buildPartnerChangeRequestDiffItems(request);

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-surface-muted p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-700">승인 대기</Badge>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {diffItems.map((item) => (
          <DiffCard
            key={item.key}
            label={item.label}
            current={item.current}
            requested={item.requested}
          />
        ))}
      </div>

      {diffItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          변경된 항목이 없습니다.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={approveAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <SubmitButton pendingText="승인 중">승인</SubmitButton>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <SubmitButton variant="danger" pendingText="거절 중">
            거절
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

export default function PartnerChangeRequestQueue({
  requests,
  approveAction,
  rejectAction,
}: {
  requests: PartnerChangeRequestSummary[];
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="space-y-6">
      <SectionHeading
        title="승인 대기 요청"
        description="변경된 항목만 현재값과 요청값으로 비교한 뒤 승인하거나 거절합니다."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="승인 대기 요청이 없습니다."
          description="협력사 담당자가 민감 정보 변경 요청을 보내면 이곳에 표시됩니다."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <PartnerChangeRequestCard
              key={request.id}
              request={request}
              approveAction={approveAction}
              rejectAction={rejectAction}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
