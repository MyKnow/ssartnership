import Badge from "@/components/ui/Badge";
import InlineMessage from "@/components/ui/InlineMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";

export function PendingRequestNotice({
  pendingRequest,
  canCancelPendingRequest,
  cancelAction,
}: {
  pendingRequest: PartnerChangeRequestSummary;
  canCancelPendingRequest: boolean;
  cancelAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <InlineMessage
        tone="warning"
        title="승인 대기 중"
        description="제출된 변경 요청은 관리자 승인 전까지 반영되지 않습니다. 즉시 반영 항목은 계속 저장할 수 있습니다."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          요청자:{" "}
          <span className="font-medium text-foreground">
            {pendingRequest.requestedByDisplayName ??
              pendingRequest.requestedByLoginId ??
              "미지정"}
          </span>
        </div>

        {canCancelPendingRequest ? (
          <form action={cancelAction}>
            <input type="hidden" name="requestId" value={pendingRequest.id} />
            <input type="hidden" name="partnerId" value={pendingRequest.partnerId} />
            <SubmitButton variant="danger" pendingText="취소 중">
              요청 취소
            </SubmitButton>
          </form>
        ) : (
          <Badge className="bg-surface text-muted-foreground">
            요청 취소는 요청자만 가능합니다.
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        요청 시각 {new Date(pendingRequest.createdAt).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}
