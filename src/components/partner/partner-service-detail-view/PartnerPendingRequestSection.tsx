import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { DiffCard } from "@/components/partner-change-request-ui/DiffPrimitives";
import type { PartnerChangeRequestDiffItem } from "@/components/partner-change-request-ui/buildDiffItems";
import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

export default function PartnerPendingRequestSection({
  pendingRequest,
  pendingDiffItems,
}: {
  pendingRequest: NonNullable<PartnerChangeRequestContext["pendingRequest"]>;
  pendingDiffItems: PartnerChangeRequestDiffItem[];
}) {
  return (
    <Card className="space-y-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Badge className="bg-amber-500/10 text-amber-700">승인 대기 중</Badge>
          <p className="text-sm leading-6 text-muted-foreground">
            변경된 항목만 현재값과 요청값으로 비교합니다.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          요청 시각 {formatKoreanDateTimeToMinute(pendingRequest.createdAt)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pendingDiffItems.map((item) => (
          <DiffCard
            key={item.key}
            label={item.label}
            current={item.current}
            requested={item.requested}
          />
        ))}
      </div>

      {pendingDiffItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          변경된 항목이 없습니다.
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
        요청자{" "}
        <span className="font-medium text-foreground">
          {pendingRequest.requestedByDisplayName ??
            pendingRequest.requestedByLoginId ??
            "미지정"}
        </span>
      </div>
    </Card>
  );
}
