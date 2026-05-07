import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { buildPartnerChangeRequestDiffItems } from "@/components/partner-change-request-ui/buildDiffItems";
import { formatDateTime } from "@/components/admin/logs/utils";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";

const requestStatusLabel: Record<PartnerChangeRequestSummary["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
  cancelled: "취소됨",
};

export default function PartnerRequestHistorySection({
  requests,
}: {
  requests: PartnerChangeRequestSummary[];
}) {
  return (
    <Card className="space-y-4 p-6 sm:p-8">
      <div>
        <Badge className="bg-primary/10 text-primary">내 수정 이력</Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          계정별 요청 이력
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          현재 로그인한 계정으로 요청한 브랜드 수정 이력만 표시됩니다.
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="표시할 요청 이력이 없습니다."
          description="이 계정으로 제출한 수정 요청이 아직 없습니다."
        />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => {
            const diffItems = buildPartnerChangeRequestDiffItems(request);

            return (
              <details
                key={request.id}
                className="rounded-2xl border border-border bg-surface-elevated"
              >
                <summary className="cursor-pointer list-none px-4 py-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{requestStatusLabel[request.status]}</Badge>
                      <Badge>{diffItems.length > 0 ? `${diffItems.length}개 변경` : "변경 없음"}</Badge>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatDateTime(request.createdAt)}
                    </span>
                  </div>
                </summary>

                <div className="grid gap-3 border-t border-border/70 px-4 py-4">
                  {diffItems.length > 0 ? (
                    diffItems.map((item) => (
                      <div
                        key={item.key}
                        className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset p-4 md:grid-cols-2"
                      >
                        <div className="grid gap-2">
                          <Badge variant="danger" className="w-fit">
                            {item.label} · 현재
                          </Badge>
                          <div className="text-sm leading-6">{item.current}</div>
                        </div>
                        <div className="grid gap-2">
                          <Badge variant="success" className="w-fit">
                            {item.label} · 요청
                          </Badge>
                          <div className="text-sm leading-6">{item.requested}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      이 요청에는 표시할 변경 diff가 없습니다.
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
