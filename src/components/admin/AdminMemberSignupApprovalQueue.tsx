import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminPaginationLink from "@/components/admin/AdminPaginationLink";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Surface from "@/components/ui/Surface";
import type { MattermostSignupApprovalRequestSummary } from "@/lib/mm-signup-approval";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import type { AdminReviewQueueFeedback } from "@/lib/admin-review-queue";

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

function buildMemberSignupQueueHref(
  returnTo: string,
  page: number,
  pageSize: number,
) {
  const url = new URL(returnTo, "https://admin.local");
  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }
  if (pageSize !== 12) {
    url.searchParams.set("pageSize", String(pageSize));
  } else {
    url.searchParams.delete("pageSize");
  }
  return url.pathname + url.search;
}

export default function AdminMemberSignupApprovalQueue({
  requests,
  statusMessage,
  returnTo = "/admin/member-signup-requests",
  feedback,
  pagination,
  loadError = false,
}: {
  requests: MattermostSignupApprovalRequestSummary[];
  statusMessage?: string | null;
  returnTo?: string;
  feedback?: AdminReviewQueueFeedback | null;
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
    <div className="grid min-w-0 gap-6">
      <AdminReviewQueueHeader
        eyebrow="가입 승인"
        title="가입 승인 요청"
        description="Mattermost 닉네임을 자동으로 해석하지 못한 가입 요청을 확인하고, 부족한 회원 정보를 직접 입력해 승인합니다."
        metrics={[
          {
            label: "승인 대기",
            value: `${effectivePagination.totalCount.toLocaleString("ko-KR")}건`,
            hint: "현재 처리할 요청",
          },
          {
            label: "현재 표시",
            value: `${requests.length.toLocaleString("ko-KR")}건`,
            hint: `${currentPage} / ${totalPages} 페이지`,
          },
        ]}
        feedback={feedback}
        nextAction={{
          title: requests.length > 0 ? "표시 이름과 신청 기수를 확인한 뒤 한 건씩 검토하세요." : "새 가입 승인 요청이 들어오면 신청 정보부터 확인하세요.",
          description: "승인 화면에서 이름·기수·캠퍼스를 보완하며, 반려할 때는 요청자가 이해할 수 있는 사유를 남깁니다.",
        }}
        showPageHeader={false}
      />
      {statusMessage && !feedback ? (
        <p className="rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {statusMessage}
        </p>
      ) : null}
      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="가입 승인 요청을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
          action={
            <Button href={returnTo} variant="secondary">
              다시 확인
            </Button>
          }
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="대기 중인 가입 승인 요청이 없습니다."
          description="파싱에 실패한 Mattermost 가입 신청이 접수되면 이곳에 표시됩니다."
          action={<Button href={returnTo} variant="secondary">목록 새로고침</Button>}
        />
      ) : (
        <div className="grid min-w-0 gap-4">
          {totalPages > 1 ? (
            <Surface
              level="inset"
              padding="sm"
              className="grid min-w-0 gap-3 text-sm text-muted-foreground lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
            >
              <p>
                {pageStart + 1}-
                {Math.min(
                  pageStart + requests.length,
                  effectivePagination.totalCount,
                )}{" "}
                / {effectivePagination.totalCount.toLocaleString("ko-KR")}
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                aria-label="페이지당 표시 건수"
              >
                {[6, 12, 24].map((pageSize) => (
                  <AdminPaginationLink
                    key={pageSize}
                    href={buildMemberSignupQueueHref(
                      returnTo,
                      1,
                      pageSize,
                    )}
                    variant={
                      pageSize === effectivePagination.pageSize
                        ? "secondary"
                        : "ghost"
                    }
                  >
                    {pageSize}개씩
                  </AdminPaginationLink>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <AdminPaginationLink
                  href={buildMemberSignupQueueHref(
                    returnTo,
                    currentPage - 1,
                    effectivePagination.pageSize,
                  )}
                  prefetch
                  disabled={currentPage === 1}
                >
                  이전
                </AdminPaginationLink>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <AdminPaginationLink
                  href={buildMemberSignupQueueHref(
                    returnTo,
                    currentPage + 1,
                    effectivePagination.pageSize,
                  )}
                  prefetch
                  disabled={currentPage === totalPages}
                >
                  다음
                </AdminPaginationLink>
              </div>
            </Surface>
          ) : null}
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
                <Button
                  href={
                    "/admin/member-signup-requests/" +
                    encodeURIComponent(request.id) +
                    "?returnTo=" +
                    encodeURIComponent(returnTo)
                  }
                  variant="secondary"
                >
                  검토하기
                </Button>
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
