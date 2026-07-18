import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type { MattermostSignupApprovalRequestSummary } from "@/lib/mm-signup-approval";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";

const PARSE_REASON_LABELS: Record<string, string> = {
  campus_ambiguous: "캠퍼스가 여러 개로 감지됨",
  student_signal_without_affiliation: "교육생 표식에 캠퍼스 정보가 없음",
  display_only: "캠퍼스 정보가 없는 표시 이름",
  display_name_not_person_like: "이름 형식으로 파싱되지 않음",
  profile_unavailable: "프로필 정보를 확인하지 못함",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "시간 미상"
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function AdminMemberSignupApprovalQueue({
  requests,
  statusMessage,
}: {
  requests: MattermostSignupApprovalRequestSummary[];
  statusMessage?: string | null;
}) {
  return (
    <div className="grid gap-6">
      <AdminPageHeader
        eyebrow="Member onboarding"
        title="가입 승인 요청"
        description="Mattermost 닉네임을 자동으로 해석하지 못한 가입 요청을 확인하고, 부족한 회원 정보를 직접 입력해 승인합니다."
      />
      {statusMessage ? (
        <p className="rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {statusMessage}
        </p>
      ) : null}
      {requests.length === 0 ? (
        <EmptyState
          title="대기 중인 가입 승인 요청이 없습니다."
          description="파싱에 실패한 Mattermost 가입 신청이 접수되면 이곳에 표시됩니다."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} tone="elevated" padding="md" className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      @{request.mmUsername}
                    </h2>
                    <Badge variant="warning">승인 대기</Badge>
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    Mattermost 표시 이름: {request.mattermostDisplayName}
                  </p>
                </div>
                <Link
                  href={`/admin/member-signup-requests/${encodeURIComponent(request.id)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-[1rem] border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-inset"
                >
                  검토하기
                </Link>
              </div>
              <div className="grid gap-2 rounded-card border border-border bg-surface-inset p-4 text-sm text-muted-foreground sm:grid-cols-3">
                <p>신청 기수: <span className="font-semibold text-foreground">{formatSsafyYearLabel(request.requestedGeneration)}</span></p>
                <p>인증 Sender: <span className="font-semibold text-foreground">{formatSsafyYearLabel(request.senderGeneration)}</span></p>
                <p>신청 시각: <span className="font-semibold text-foreground">{formatDate(request.createdAt)}</span></p>
              </div>
              <p className="text-sm text-muted-foreground">
                파싱 결과: <span className="font-medium text-foreground">{PARSE_REASON_LABELS[request.parseExclusionReason ?? ""] ?? "수동 확인 필요"}</span>
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function getSignupApprovalStatusMessage(value: string | undefined) {
  if (value === "approved") return "가입 요청을 승인하고 회원을 생성했습니다.";
  if (value === "rejected") return "가입 요청을 반려했습니다.";
  return null;
}
