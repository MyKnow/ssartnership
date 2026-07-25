import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import AdminGraduateVerificationMediaViewer from "@/components/admin/AdminGraduateVerificationMediaViewer";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import type { AdminReviewQueueFeedback } from "@/lib/admin-review-queue";

export type AdminGraduateVerificationRequest = {
  id: string;
  email: string;
  legal_name: string;
  education_start_year: number;
  education_start_month: number;
  education_end_year: number;
  education_end_month: number;
  inferred_generation: number;
  campus: string | null;
  request_kind: "graduate_signup" | "existing_member_recovery";
  recovery_member_id: string | null;
  status: string;
  profile_image_id: string | null;
  created_at: string;
};

export type AdminGraduateSetupEmailRetry = {
  id: string;
  email: string;
  legal_name: string;
  setup_email_last_error_at: string | null;
};

type QueueActions = {
  startReview: (formData: FormData) => Promise<void>;
  requestResubmission: (formData: FormData) => Promise<void>;
  approveRequest: (formData: FormData) => Promise<void>;
  rejectRequest: (formData: FormData) => Promise<void>;
  resendSetupEmail: (formData: FormData) => Promise<void>;
};

function statusBadgeVariant(status: string) {
  if (status === "submitted") return "warning" as const;
  if (status === "in_review") return "primary" as const;
  if (status === "needs_resubmission") return "danger" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "submitted") return "검토 대기";
  if (status === "in_review") return "검토 중";
  if (status === "needs_resubmission") return "보완 필요";
  return "상태 확인 필요";
}

type QueuePaginationState = {
  totalCount: number;
  page: number;
  pageSize: number;
};

function buildGraduateQueuePageHref(
  returnTo: string,
  pageParam: "requestPage" | "setupEmailRetryPage",
  page: number,
) {
  const url = new URL(returnTo, "https://admin.local");
  if (page > 1) {
    url.searchParams.set(pageParam, String(page));
  } else {
    url.searchParams.delete(pageParam);
  }
  return url.pathname + url.search;
}

function QueuePagination({
  label,
  pagination,
  returnTo,
  pageParam,
}: {
  label: string;
  pagination: QueuePaginationState;
  returnTo: string;
  pageParam: "requestPage" | "setupEmailRetryPage";
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.totalCount / pagination.pageSize),
  );
  const currentPage = Math.min(pagination.page, totalPages);
  const pageStart = (currentPage - 1) * pagination.pageSize;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <Surface
      level="inset"
      padding="sm"
      className="flex min-w-0 flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        {label} {pageStart + 1}-
        {Math.min(pageStart + pagination.pageSize, pagination.totalCount)} /{" "}
        {pagination.totalCount.toLocaleString("ko-KR")}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Button
          href={buildGraduateQueuePageHref(
            returnTo,
            pageParam,
            currentPage - 1,
          )}
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
          href={buildGraduateQueuePageHref(
            returnTo,
            pageParam,
            currentPage + 1,
          )}
          variant="secondary"
          size="sm"
          prefetch
          disabled={currentPage === totalPages}
        >
          다음
        </Button>
      </div>
    </Surface>
  );
}

export default function AdminGraduateVerificationQueue({
  requests,
  setupEmailRetries,
  actions,
  feedback,
  returnTo = "/admin/graduate-verifications",
  requestPagination,
  setupEmailRetryPagination,
  loadError = false,
}: {
  requests: AdminGraduateVerificationRequest[];
  setupEmailRetries: AdminGraduateSetupEmailRetry[];
  actions: QueueActions;
  feedback?: AdminReviewQueueFeedback | null;
  returnTo?: string;
  requestPagination?: QueuePaginationState;
  setupEmailRetryPagination?: QueuePaginationState;
  loadError?: boolean;
}) {
  const submittedCount = requests.filter((request) => request.status === "submitted").length;
  const inReviewCount = requests.filter((request) => request.status === "in_review").length;
  const effectiveRequestPagination = requestPagination ?? {
    totalCount: requests.length,
    page: 1,
    pageSize: Math.max(1, requests.length),
  };
  const effectiveSetupEmailRetryPagination = setupEmailRetryPagination ?? {
    totalCount: setupEmailRetries.length,
    page: 1,
    pageSize: Math.max(1, setupEmailRetries.length),
  };

  return (
    <div className="grid min-w-0 gap-8">
      <AdminReviewQueueHeader
        eyebrow="검토"
        title="수료생 인증 검토"
        description="신규 수료생과 기존 회원 복구 요청의 증빙을 확인하고, 다음 상태로 안전하게 전환합니다."
        actions={
          <Button
            href="#graduate-request-queue-heading"
            variant="secondary"
          >
            신규 인증으로
          </Button>
        }
        metrics={[
          { label: "검토 대기", value: `${effectiveRequestPagination.totalCount.toLocaleString("ko-KR")}건`, hint: "현재 큐에 있는 요청" },
          { label: "신규 접수", value: `${submittedCount}건`, hint: "현재 페이지에서 아직 검토 전" },
          { label: "검토 중", value: `${inReviewCount}건`, hint: "현재 페이지에서 관리자 확인 중" },
          { label: "메일 재발송", value: `${effectiveSetupEmailRetryPagination.totalCount.toLocaleString("ko-KR")}건`, hint: "설정 메일 실패 건" },
        ]}
        feedback={feedback}
        nextAction={{
          title: requests.length > 0 ? "증빙과 요청 유형을 확인한 뒤 검토를 시작하세요." : "새 인증 요청이 들어오면 증빙과 요청 유형부터 확인하세요.",
          description: "기존 회원 복구 요청은 대상 회원 ID와 신청 이메일을 함께 확인해야 새 회원이 중복 생성되지 않습니다.",
        }}
      />
      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="수료생 인증 요청을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
          action={<Button href={returnTo} variant="secondary">다시 확인</Button>}
        />
      ) : (
        <>
      <section className="space-y-4" aria-labelledby="graduate-request-queue-heading">
        <div><p className="ui-kicker">New verification</p><h2 id="graduate-request-queue-heading" className="text-xl font-semibold">신규 인증</h2></div>
        <QueuePagination
          label="신규 인증"
          pagination={effectiveRequestPagination}
          returnTo={returnTo}
          pageParam="requestPage"
        />
        {requests.length === 0 ? <EmptyState title="검토할 신규 인증이 없습니다." description="새 수료생 신청이 제출되면 이곳에서 수료증과 사진을 함께 검토합니다." action={<Button href="/admin/graduate-verifications" variant="secondary">큐 새로고침</Button>} /> : <div className="grid gap-4">{requests.map((request) => {
          const isExistingMemberRecovery = request.request_kind === "existing_member_recovery";
          return <Card key={request.id} padding="md" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{request.legal_name}</h3><Badge variant={statusBadgeVariant(request.status)}>{statusLabel(request.status)}</Badge><Badge variant="neutral">{request.inferred_generation}기</Badge>{isExistingMemberRecovery ? <Badge variant="danger">기존 회원 복구</Badge> : <Badge variant="neutral">신규 수료생</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{request.email}</p><p className="mt-1 text-sm text-muted-foreground">{request.education_start_year}.{String(request.education_start_month).padStart(2, "0")} ~ {request.education_end_year}.{String(request.education_end_month).padStart(2, "0")} · {request.campus || "캠퍼스 미입력"}</p></div><AdminGraduateVerificationMediaViewer requestId={request.id} profileImageId={request.profile_image_id} /></div><div className="flex flex-wrap gap-2"><form action={actions.startReview}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="returnTo" value={returnTo} /><SubmitButton variant="secondary" pendingText="시작 중">검토 시작</SubmitButton></form><form action={actions.approveRequest} className="flex flex-wrap items-center gap-2"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="returnTo" value={returnTo} /><input name="documentNumber" required maxLength={160} className="h-11 min-w-56 rounded-[1rem] border border-border bg-surface px-3 text-sm" placeholder="수료증 문서 번호" />{isExistingMemberRecovery ? <label className="grid gap-1 text-xs font-medium text-muted-foreground">연결할 기존 회원 ID<input name="existingMemberId" required pattern="[0-9a-fA-F-]{36}" className="h-11 min-w-72 rounded-[1rem] border border-danger/40 bg-surface px-3 text-sm text-foreground" placeholder="기존 회원 UUID를 명시적으로 선택" /></label> : null}<SubmitButton pendingText={isExistingMemberRecovery ? "연결 중" : "승인 중"}>{isExistingMemberRecovery ? "기존 회원 연결 및 설정 메일" : "승인 및 비밀번호 설정 메일"}</SubmitButton></form></div>{isExistingMemberRecovery ? <p className="rounded-card border border-danger/20 bg-danger/5 p-3 text-sm text-muted-foreground">이 승인에서는 위 기존 회원 ID가 반드시 필요하며, 새 회원 행을 만들지 않습니다. 회원 상세에서 대상 ID와 신청 이메일 일치를 확인해 주세요.</p> : null}<details className="rounded-card border border-border bg-surface-inset p-3"><summary className="cursor-pointer font-medium">보완 또는 반려</summary><div className="mt-3 grid gap-3"><form action={actions.requestResubmission} className="grid gap-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="returnTo" value={returnTo} /><div className="flex flex-wrap gap-3 text-sm"><label><input type="checkbox" name="target" value="education_period" /> 교육 기간</label><label><input type="checkbox" name="target" value="certificate" /> 수료증</label><label><input type="checkbox" name="target" value="profile_image" /> 본인 사진</label></div><textarea name="note" maxLength={500} className="min-h-20 rounded-card border border-border bg-surface px-3 py-2 text-sm" placeholder="보완 요청 사유" /><SubmitButton variant="secondary" pendingText="요청 중">보완 요청</SubmitButton></form><form action={actions.rejectRequest} className="grid gap-2"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="returnTo" value={returnTo} /><textarea name="reason" required maxLength={500} className="min-h-20 rounded-card border border-border bg-surface px-3 py-2 text-sm" placeholder="반려 사유" /><SubmitButton variant="danger" pendingText="반려 중">반려</SubmitButton></form></div></details></Card>;
        })}</div>}
      </section>
      <section className="space-y-4" aria-labelledby="graduate-setup-email-retry-heading">
        <div>
          <p className="ui-kicker">Account setup</p>
          <h2 id="graduate-setup-email-retry-heading" className="text-xl font-semibold">
            비밀번호 설정 메일 재발송
          </h2>
        </div>
        <QueuePagination
          label="메일 재발송"
          pagination={effectiveSetupEmailRetryPagination}
          returnTo={returnTo}
          pageParam="setupEmailRetryPage"
        />
        {setupEmailRetries.length === 0 ? (
          <EmptyState
            title="재발송할 비밀번호 설정 메일이 없습니다."
            description="승인 직후 메일 전송에 실패한 수료생 계정만 이곳에 표시됩니다."
            action={<Button href="/admin/graduate-verifications" variant="secondary">큐 새로고침</Button>}
          />
        ) : (
          <div className="grid gap-4">
            {setupEmailRetries.map((request) => (
              <Card key={request.id} padding="md" className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{request.legal_name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{request.email}</p>
                  <p className="mt-1 text-xs text-danger">이전 비밀번호 설정 메일 전송에 실패했습니다.</p>
                </div>
                <form action={actions.resendSetupEmail}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <SubmitButton pendingText="재발송 중">설정 메일 다시 보내기</SubmitButton>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
