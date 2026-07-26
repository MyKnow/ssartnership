import { Suspense } from "react";
import AdminGraduateVerificationMediaViewer from "@/components/admin/AdminGraduateVerificationMediaViewer";
import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import Textarea from "@/components/ui/Textarea";
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

export type QueuePaginationState = {
  totalCount: number;
  page: number;
  pageSize: number;
};

type SetupEmailRetryQueue = {
  setupEmailRetries: AdminGraduateSetupEmailRetry[];
  setupEmailRetryPagination: QueuePaginationState;
  queueLoadError: boolean;
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

function QueueActionFields({
  requestId,
  returnTo,
}: {
  requestId: string;
  returnTo: string;
}) {
  return (
    <>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
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

function GraduateVerificationDecisionCard({
  request,
  actions,
  returnTo,
  canUpdate,
}: {
  request: AdminGraduateVerificationRequest;
  actions: QueueActions;
  returnTo: string;
  canUpdate: boolean;
}) {
  const isExistingMemberRecovery =
    request.request_kind === "existing_member_recovery";
  const requestHeadingId = `graduate-request-${request.id}`;
  const documentNumberInputId = `graduate-document-number-${request.id}`;
  const documentNumberHelpId = `${documentNumberInputId}-help`;
  const existingMemberIdInputId = `graduate-existing-member-${request.id}`;
  const existingMemberIdHelpId = `${existingMemberIdInputId}-help`;
  const resubmissionNoteId = `graduate-resubmission-note-${request.id}`;
  const resubmissionNoteHelpId = `${resubmissionNoteId}-help`;
  const rejectionReasonId = `graduate-rejection-reason-${request.id}`;
  const rejectionReasonHelpId = `${rejectionReasonId}-help`;

  return (
    <Card padding="md" className="grid min-w-0 gap-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 id={requestHeadingId} className="min-w-0 text-lg font-semibold">
              {request.legal_name}
            </h3>
            <Badge variant={statusBadgeVariant(request.status)}>
              {statusLabel(request.status)}
            </Badge>
            <Badge variant="neutral">{request.inferred_generation}기</Badge>
            {isExistingMemberRecovery ? (
              <Badge variant="danger">기존 회원 복구</Badge>
            ) : (
              <Badge variant="neutral">신규 수료생</Badge>
            )}
          </div>
          <p
            className="mt-1 max-w-full truncate text-sm text-muted-foreground"
            title={request.email}
          >
            {request.email}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {request.education_start_year}.
            {String(request.education_start_month).padStart(2, "0")} ~{" "}
            {request.education_end_year}.
            {String(request.education_end_month).padStart(2, "0")} ·{" "}
            {request.campus || "캠퍼스 미입력"}
          </p>
        </div>
        <AdminGraduateVerificationMediaViewer
          requestId={request.id}
          profileImageId={request.profile_image_id}
        />
      </div>

      {canUpdate ? (
        <div className="flex flex-wrap gap-2">
          <form action={actions.startReview}>
            <QueueActionFields requestId={request.id} returnTo={returnTo} />
            <SubmitButton variant="secondary" pendingText="검토를 시작하는 중">
              검토 시작
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {canUpdate ? (
        <Surface level="inset" padding="md" className="grid min-w-0 gap-4">
          <form
            action={actions.approveRequest}
            className="grid min-w-0 gap-4"
            aria-labelledby={`${requestHeadingId}-approval-title`}
          >
            <QueueActionFields requestId={request.id} returnTo={returnTo} />
            <fieldset className="grid min-w-0 gap-4">
              <legend
                id={`${requestHeadingId}-approval-title`}
                className="text-sm font-semibold text-foreground"
              >
                결정 전 확인
              </legend>
              <p className="text-sm leading-6 text-muted-foreground">
                증빙을 확인한 뒤 아래 정보를 입력하면 이 요청을 승인합니다.
              </p>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <div className="grid min-w-0 gap-1.5">
                  <label
                    htmlFor={documentNumberInputId}
                    className="text-sm font-medium text-foreground"
                  >
                    수료증 문서 번호
                  </label>
                  <Input
                    id={documentNumberInputId}
                    name="documentNumber"
                    required
                    maxLength={160}
                    aria-describedby={documentNumberHelpId}
                    placeholder="예: SSAFY-15-2026-0001"
                  />
                  <p
                    id={documentNumberHelpId}
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    수료증에 적힌 문서 번호를 입력하세요. 원문은 승인 이력에
                    표시하지 않습니다.
                  </p>
                </div>

                {isExistingMemberRecovery ? (
                  <div className="grid min-w-0 gap-1.5">
                    <label
                      htmlFor={existingMemberIdInputId}
                      className="text-sm font-medium text-foreground"
                    >
                      연결할 기존 회원 ID
                    </label>
                    <Input
                      id={existingMemberIdInputId}
                      name="existingMemberId"
                      required
                      pattern="[0-9a-fA-F-]{36}"
                      aria-describedby={existingMemberIdHelpId}
                      placeholder="00000000-0000-0000-0000-000000000000"
                    />
                    <p
                      id={existingMemberIdHelpId}
                      className="text-xs leading-5 text-muted-foreground"
                    >
                      회원 상세에서 복사한 UUID를 입력하세요. 새 회원은 만들지
                      않습니다.
                    </p>
                  </div>
                ) : null}
              </div>
              {isExistingMemberRecovery ? (
                <p
                  className="border-l-2 border-danger/50 pl-3 text-sm leading-6 text-muted-foreground"
                  role="note"
                >
                  신청 이메일과 기존 회원을 함께 확인한 뒤 승인하세요. 잘못
                  연결하면 기존 인증 정보에 영향을 줄 수 있습니다.
                </p>
              ) : null}
              <div>
                <SubmitButton
                  pendingText={
                    isExistingMemberRecovery
                      ? "기존 회원을 연결하는 중"
                      : "승인하는 중"
                  }
                >
                  {isExistingMemberRecovery
                    ? "기존 회원 연결 및 설정 메일"
                    : "승인 및 비밀번호 설정 메일"}
                </SubmitButton>
              </div>
            </fieldset>
          </form>
        </Surface>
      ) : null}

      {canUpdate ? (
        <Surface level="inset" padding="md" className="min-w-0">
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center rounded-control px-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
              보완 요청 또는 반려
            </summary>
            <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-2">
              <form
                action={actions.requestResubmission}
                className="grid min-w-0 gap-4"
              >
                <QueueActionFields requestId={request.id} returnTo={returnTo} />
                <fieldset className="grid min-w-0 gap-3">
                  <legend className="text-sm font-semibold text-foreground">
                    보완 요청
                  </legend>
                  <p className="text-sm leading-6 text-muted-foreground">
                    보완이 필요한 항목을 하나 이상 고르고, 회원에게 전달할
                    안내를 입력하세요.
                  </p>
                  <div
                    className="grid gap-2 sm:grid-cols-3"
                    role="group"
                    aria-label="보완이 필요한 항목"
                  >
                    {[
                      { value: "education_period", label: "교육 기간" },
                      { value: "certificate", label: "수료증" },
                      { value: "profile_image", label: "본인 사진" },
                    ].map((target) => (
                      <label
                        key={target.value}
                        className="flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface-control px-3 text-sm font-medium text-foreground"
                      >
                        <input
                          type="checkbox"
                          name="target"
                          value={target.value}
                          className="size-5 shrink-0 accent-primary"
                        />
                        <span>{target.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <label
                      htmlFor={resubmissionNoteId}
                      className="text-sm font-medium text-foreground"
                    >
                      보완 요청 사유
                    </label>
                    <Textarea
                      id={resubmissionNoteId}
                      name="note"
                      maxLength={500}
                      aria-describedby={resubmissionNoteHelpId}
                      placeholder="예: 수료증의 교육 기간이 신청 내용과 다릅니다."
                    />
                    <p
                      id={resubmissionNoteHelpId}
                      className="text-xs leading-5 text-muted-foreground"
                    >
                      최대 500자까지 입력할 수 있습니다. 개인정보나 내부 운영
                      메모는 적지 마세요.
                    </p>
                  </div>
                  <div>
                    <SubmitButton
                      variant="secondary"
                      pendingText="보완을 요청하는 중"
                    >
                      보완 요청 보내기
                    </SubmitButton>
                  </div>
                </fieldset>
              </form>

              <form
                action={actions.rejectRequest}
                className="grid min-w-0 gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
              >
                <QueueActionFields requestId={request.id} returnTo={returnTo} />
                <fieldset className="grid min-w-0 gap-3">
                  <legend className="text-sm font-semibold text-foreground">
                    반려
                  </legend>
                  <p className="text-sm leading-6 text-muted-foreground">
                    반려하면 이 요청은 다시 승인할 수 없습니다. 사유를
                    구체적으로 남겨 주세요.
                  </p>
                  <div className="grid min-w-0 gap-1.5">
                    <label
                      htmlFor={rejectionReasonId}
                      className="text-sm font-medium text-foreground"
                    >
                      반려 사유
                    </label>
                    <Textarea
                      id={rejectionReasonId}
                      name="reason"
                      required
                      maxLength={500}
                      aria-describedby={rejectionReasonHelpId}
                      placeholder="반려 사유를 입력하세요"
                    />
                    <p
                      id={rejectionReasonHelpId}
                      className="text-xs leading-5 text-muted-foreground"
                    >
                      1자 이상 500자 이하로 입력하세요. 회원이 이해할 수 있는
                      표현을 사용하세요.
                    </p>
                  </div>
                  <div>
                    <SubmitButton variant="danger" pendingText="반려하는 중">
                      요청 반려
                    </SubmitButton>
                  </div>
                </fieldset>
              </form>
            </div>
          </details>
        </Surface>
      ) : (
        <Surface level="inset" padding="md">
          <p className="text-sm font-semibold text-foreground">
            조회 전용 권한
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            신청 정보와 증빙은 확인할 수 있지만, 검토 시작·승인·보완 요청·반려는
            수료생 인증 운영 권한이 있는 관리자만 할 수 있습니다.
          </p>
        </Surface>
      )}
    </Card>
  );
}

function GraduateVerificationHeader({
  requests,
  requestPagination,
  setupEmailRetryCount,
  feedback,
  canUpdate,
}: {
  requests: AdminGraduateVerificationRequest[];
  requestPagination: QueuePaginationState;
  setupEmailRetryCount: number | null;
  feedback?: AdminReviewQueueFeedback | null;
  canUpdate: boolean;
}) {
  const submittedCount = requests.filter(
    (request) => request.status === "submitted",
  ).length;
  const inReviewCount = requests.filter(
    (request) => request.status === "in_review",
  ).length;

  return (
    <AdminReviewQueueHeader
      eyebrow="검토"
      title="수료생 인증 검토"
      description="신규 수료생과 기존 회원 복구 요청의 증빙을 확인하고, 다음 상태로 안전하게 전환합니다."
      actions={
        <Button href="#graduate-request-queue-heading" variant="secondary">
          신규 인증으로
        </Button>
      }
      metrics={[
        {
          label: "검토 대기",
          value: `${requestPagination.totalCount.toLocaleString("ko-KR")}건`,
          hint: "현재 큐에 있는 요청",
        },
        {
          label: "신규 접수",
          value: `${submittedCount}건`,
          hint: "현재 페이지에서 아직 검토 전",
        },
        {
          label: "검토 중",
          value: `${inReviewCount}건`,
          hint: "현재 페이지에서 관리자 확인 중",
        },
        {
          label: "메일 재발송",
          value:
            setupEmailRetryCount === null
              ? "확인 중"
              : `${setupEmailRetryCount.toLocaleString("ko-KR")}건`,
          hint:
            setupEmailRetryCount === null
              ? "보조 큐를 불러오는 중"
              : "설정 메일 실패 건",
        },
      ]}
      feedback={feedback}
      nextAction={{
        title: canUpdate
          ? requests.length > 0
            ? "증빙과 요청 유형을 확인한 뒤 검토를 시작하세요."
            : "새 인증 요청이 들어오면 증빙과 요청 유형부터 확인하세요."
          : "신청 정보와 증빙을 확인하세요.",
        description: canUpdate
          ? "기존 회원 복구 요청은 대상 회원 ID와 신청 이메일을 함께 확인해야 새 회원이 중복 생성되지 않습니다."
          : "현재 계정은 요청과 증빙을 확인할 수 있지만 검토 결과를 변경할 수 없습니다.",
      }}
    />
  );
}

function GraduateVerificationRequestSection({
  requests,
  actions,
  returnTo,
  pagination,
  canUpdate,
}: {
  requests: AdminGraduateVerificationRequest[];
  actions: QueueActions;
  returnTo: string;
  pagination: QueuePaginationState;
  canUpdate: boolean;
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby="graduate-request-queue-heading"
    >
      <div>
        <p className="ui-kicker">New verification</p>
        <h2
          id="graduate-request-queue-heading"
          className="text-xl font-semibold"
        >
          신규 인증
        </h2>
      </div>
      <QueuePagination
        label="신규 인증"
        pagination={pagination}
        returnTo={returnTo}
        pageParam="requestPage"
      />
      {requests.length === 0 ? (
        <EmptyState
          title="검토할 신규 인증이 없습니다."
          description="새 수료생 신청이 제출되면 이곳에서 수료증과 사진을 함께 검토합니다."
          action={
            <Button href="/admin/graduate-verifications" variant="secondary">
              큐 새로고침
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <GraduateVerificationDecisionCard
              key={request.id}
              request={request}
              actions={actions}
              returnTo={returnTo}
              canUpdate={canUpdate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GraduateSetupEmailRetrySection({
  setupEmailRetries,
  pagination,
  actions,
  returnTo,
  loadError,
  canUpdate,
}: {
  setupEmailRetries: AdminGraduateSetupEmailRetry[];
  pagination: QueuePaginationState;
  actions: QueueActions;
  returnTo: string;
  loadError: boolean;
  canUpdate: boolean;
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby="graduate-setup-email-retry-heading"
    >
      <div>
        <p className="ui-kicker">Account setup</p>
        <h2
          id="graduate-setup-email-retry-heading"
          className="text-xl font-semibold"
        >
          비밀번호 설정 메일 재발송
        </h2>
      </div>
      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="메일 재발송 대상을 불러오지 못했습니다."
          description="인증 검토는 계속할 수 있습니다. 잠시 후 다시 확인해 주세요."
          action={
            <Button href={returnTo} variant="secondary">
              다시 확인
            </Button>
          }
        />
      ) : (
        <>
          {!canUpdate ? (
            <Surface level="inset" padding="md">
              <p className="text-sm font-semibold text-foreground">
                조회 전용 권한
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                재발송 대상과 실패 상태는 확인할 수 있지만, 설정 메일 재발송은
                수료생 인증 운영 권한이 있는 관리자만 할 수 있습니다.
              </p>
            </Surface>
          ) : null}
          <QueuePagination
            label="메일 재발송"
            pagination={pagination}
            returnTo={returnTo}
            pageParam="setupEmailRetryPage"
          />
          {setupEmailRetries.length === 0 ? (
            <EmptyState
              title="재발송할 비밀번호 설정 메일이 없습니다."
              description="승인 직후 메일 전송에 실패한 수료생 계정만 이곳에 표시됩니다."
              action={
                <Button
                  href="/admin/graduate-verifications"
                  variant="secondary"
                >
                  큐 새로고침
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {setupEmailRetries.map((request) => (
                <Card
                  key={request.id}
                  padding="md"
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold">{request.legal_name}</h3>
                    <p
                      className="mt-1 max-w-full truncate text-sm text-muted-foreground"
                      title={request.email}
                    >
                      {request.email}
                    </p>
                    <p className="mt-1 text-xs text-danger">
                      이전 비밀번호 설정 메일 전송에 실패했습니다.
                    </p>
                  </div>
                  {canUpdate ? (
                    <form action={actions.resendSetupEmail}>
                      <QueueActionFields
                        requestId={request.id}
                        returnTo={returnTo}
                      />
                      <SubmitButton pendingText="설정 메일을 다시 보내는 중">
                        설정 메일 다시 보내기
                      </SubmitButton>
                    </form>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function GraduateVerificationLoadError({ returnTo }: { returnTo: string }) {
  return (
    <AdminStatePanel
      kind="error"
      title="수료생 인증 요청을 불러오지 못했습니다."
      description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
      action={
        <Button href={returnTo} variant="secondary">
          다시 확인
        </Button>
      }
    />
  );
}

export default function AdminGraduateVerificationQueue({
  requests,
  setupEmailRetries,
  setupEmailRetryQueue,
  actions,
  feedback,
  returnTo = "/admin/graduate-verifications",
  requestPagination,
  setupEmailRetryPagination,
  loadError = false,
  canUpdate = true,
}: {
  requests: AdminGraduateVerificationRequest[];
  setupEmailRetries?: AdminGraduateSetupEmailRetry[];
  setupEmailRetryQueue?: Promise<SetupEmailRetryQueue>;
  actions: QueueActions;
  feedback?: AdminReviewQueueFeedback | null;
  returnTo?: string;
  requestPagination?: QueuePaginationState;
  setupEmailRetryPagination?: QueuePaginationState;
  loadError?: boolean;
  canUpdate?: boolean;
}) {
  if (setupEmailRetryQueue) {
    return (
      <AdminGraduateVerificationStreamingView
        requests={requests}
        setupEmailRetryQueue={setupEmailRetryQueue}
        actions={actions}
        feedback={feedback}
        returnTo={returnTo}
        requestPagination={requestPagination}
        loadError={loadError}
        canUpdate={canUpdate}
      />
    );
  }

  const safeSetupEmailRetries = setupEmailRetries ?? [];
  const effectiveRequestPagination = requestPagination ?? {
    totalCount: requests.length,
    page: 1,
    pageSize: Math.max(1, requests.length),
  };
  const effectiveSetupEmailRetryPagination = setupEmailRetryPagination ?? {
    totalCount: safeSetupEmailRetries.length,
    page: 1,
    pageSize: Math.max(1, safeSetupEmailRetries.length),
  };

  return (
    <div className="grid min-w-0 gap-8">
      <GraduateVerificationHeader
        requests={requests}
        requestPagination={effectiveRequestPagination}
        setupEmailRetryCount={effectiveSetupEmailRetryPagination.totalCount}
        feedback={feedback}
        canUpdate={canUpdate}
      />

      {loadError ? (
        <GraduateVerificationLoadError returnTo={returnTo} />
      ) : (
        <>
          <GraduateVerificationRequestSection
            requests={requests}
            actions={actions}
            returnTo={returnTo}
            pagination={effectiveRequestPagination}
            canUpdate={canUpdate}
          />

          <GraduateSetupEmailRetrySection
            setupEmailRetries={safeSetupEmailRetries}
            pagination={effectiveSetupEmailRetryPagination}
            actions={actions}
            returnTo={returnTo}
            loadError={false}
            canUpdate={canUpdate}
          />
        </>
      )}
    </div>
  );
}

export function AdminGraduateVerificationRetryLoading() {
  return (
    <section
      className="space-y-4"
      aria-labelledby="graduate-setup-email-retry-heading"
      aria-busy="true"
    >
      <div>
        <p className="ui-kicker">Account setup</p>
        <h2
          id="graduate-setup-email-retry-heading"
          className="text-xl font-semibold"
        >
          비밀번호 설정 메일 재발송
        </h2>
      </div>
      <Surface level="inset" padding="md">
        <p role="status" className="text-sm text-muted-foreground">
          {
            "메일 재발송 대상을 확인하는 중입니다. 신규 인증 검토는 지금 바로 시작할 수 있습니다."
          }
        </p>
      </Surface>
    </section>
  );
}

async function GraduateVerificationRetryBoundary({
  setupEmailRetryQueue,
  actions,
  returnTo,
  canUpdate,
}: {
  setupEmailRetryQueue: Promise<SetupEmailRetryQueue>;
  actions: QueueActions;
  returnTo: string;
  canUpdate: boolean;
}) {
  const queue = await setupEmailRetryQueue;

  return (
    <GraduateSetupEmailRetrySection
      setupEmailRetries={queue.setupEmailRetries}
      pagination={queue.setupEmailRetryPagination}
      actions={actions}
      returnTo={returnTo}
      loadError={queue.queueLoadError}
      canUpdate={canUpdate}
    />
  );
}

function AdminGraduateVerificationStreamingView({
  requests,
  setupEmailRetryQueue,
  actions,
  feedback,
  returnTo,
  requestPagination,
  loadError,
  canUpdate,
}: {
  requests: AdminGraduateVerificationRequest[];
  setupEmailRetryQueue: Promise<SetupEmailRetryQueue>;
  actions: QueueActions;
  feedback?: AdminReviewQueueFeedback | null;
  returnTo: string;
  requestPagination?: QueuePaginationState;
  loadError: boolean;
  canUpdate: boolean;
}) {
  const effectiveRequestPagination = requestPagination ?? {
    totalCount: requests.length,
    page: 1,
    pageSize: Math.max(1, requests.length),
  };

  return (
    <div className="grid min-w-0 gap-8">
      <GraduateVerificationHeader
        requests={requests}
        requestPagination={effectiveRequestPagination}
        setupEmailRetryCount={null}
        feedback={feedback}
        canUpdate={canUpdate}
      />

      {loadError ? (
        <GraduateVerificationLoadError returnTo={returnTo} />
      ) : (
        <>
          <GraduateVerificationRequestSection
            requests={requests}
            actions={actions}
            returnTo={returnTo}
            pagination={effectiveRequestPagination}
            canUpdate={canUpdate}
          />

          <Suspense fallback={<AdminGraduateVerificationRetryLoading />}>
            <GraduateVerificationRetryBoundary
              setupEmailRetryQueue={setupEmailRetryQueue}
              actions={actions}
              returnTo={returnTo}
              canUpdate={canUpdate}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
