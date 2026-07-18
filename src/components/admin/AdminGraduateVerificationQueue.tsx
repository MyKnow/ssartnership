import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AdminGraduateVerificationMediaViewer from "@/components/admin/AdminGraduateVerificationMediaViewer";

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

export default function AdminGraduateVerificationQueue({
  requests,
  setupEmailRetries,
  actions,
}: {
  requests: AdminGraduateVerificationRequest[];
  setupEmailRetries: AdminGraduateSetupEmailRetry[];
  actions: QueueActions;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="graduate-request-queue-heading">
        <div><p className="ui-kicker">New verification</p><h2 id="graduate-request-queue-heading" className="text-xl font-semibold">신규 인증</h2></div>
        {requests.length === 0 ? <EmptyState title="검토할 신규 인증이 없습니다." description="새 수료생 신청이 제출되면 이곳에서 수료증과 사진을 함께 검토합니다." /> : <div className="grid gap-4">{requests.map((request) => {
          const isExistingMemberRecovery = request.request_kind === "existing_member_recovery";
          return <Card key={request.id} padding="md" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{request.legal_name}</h3><Badge variant={statusBadgeVariant(request.status)}>{request.status}</Badge><Badge variant="neutral">{request.inferred_generation}기</Badge>{isExistingMemberRecovery ? <Badge variant="danger">기존 회원 복구</Badge> : <Badge variant="neutral">신규 수료생</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{request.email}</p><p className="mt-1 text-sm text-muted-foreground">{request.education_start_year}.{String(request.education_start_month).padStart(2, "0")} ~ {request.education_end_year}.{String(request.education_end_month).padStart(2, "0")} · {request.campus || "캠퍼스 미입력"}</p></div><AdminGraduateVerificationMediaViewer requestId={request.id} profileImageId={request.profile_image_id} /></div><div className="flex flex-wrap gap-2"><form action={actions.startReview}><input type="hidden" name="requestId" value={request.id} /><Button variant="secondary" type="submit">검토 시작</Button></form><form action={actions.approveRequest} className="flex flex-wrap items-center gap-2"><input type="hidden" name="requestId" value={request.id} /><input name="documentNumber" required maxLength={160} className="h-11 min-w-56 rounded-[1rem] border border-border bg-surface px-3 text-sm" placeholder="수료증 문서 번호" />{isExistingMemberRecovery ? <label className="grid gap-1 text-xs font-medium text-muted-foreground">연결할 기존 회원 ID<input name="existingMemberId" required pattern="[0-9a-fA-F-]{36}" className="h-11 min-w-72 rounded-[1rem] border border-danger/40 bg-surface px-3 text-sm text-foreground" placeholder="기존 회원 UUID를 명시적으로 선택" /></label> : null}<Button type="submit">{isExistingMemberRecovery ? "기존 회원 연결 및 설정 메일" : "승인 및 비밀번호 설정 메일"}</Button></form></div>{isExistingMemberRecovery ? <p className="rounded-card border border-danger/20 bg-danger/5 p-3 text-sm text-muted-foreground">이 승인에서는 위 기존 회원 ID가 반드시 필요하며, 새 회원 행을 만들지 않습니다. 회원 상세에서 대상 ID와 신청 이메일 일치를 확인해 주세요.</p> : null}<details className="rounded-card border border-border bg-surface-inset p-3"><summary className="cursor-pointer font-medium">보완 또는 반려</summary><div className="mt-3 grid gap-3"><form action={actions.requestResubmission} className="grid gap-3"><input type="hidden" name="requestId" value={request.id} /><div className="flex flex-wrap gap-3 text-sm"><label><input type="checkbox" name="target" value="education_period" /> 교육 기간</label><label><input type="checkbox" name="target" value="certificate" /> 수료증</label><label><input type="checkbox" name="target" value="profile_image" /> 본인 사진</label></div><textarea name="note" maxLength={500} className="min-h-20 rounded-card border border-border bg-surface px-3 py-2 text-sm" placeholder="보완 요청 사유" /><Button variant="secondary" type="submit">보완 요청</Button></form><form action={actions.rejectRequest} className="grid gap-2"><input type="hidden" name="requestId" value={request.id} /><textarea name="reason" required maxLength={500} className="min-h-20 rounded-card border border-border bg-surface px-3 py-2 text-sm" placeholder="반려 사유" /><Button variant="danger" type="submit">반려</Button></form></div></details></Card>;
        })}</div>}
      </section>
      <section className="space-y-4" aria-labelledby="graduate-setup-email-retry-heading">
        <div>
          <p className="ui-kicker">Account setup</p>
          <h2 id="graduate-setup-email-retry-heading" className="text-xl font-semibold">
            비밀번호 설정 메일 재발송
          </h2>
        </div>
        {setupEmailRetries.length === 0 ? (
          <EmptyState
            title="재발송할 비밀번호 설정 메일이 없습니다."
            description="승인 직후 메일 전송에 실패한 수료생 계정만 이곳에 표시됩니다."
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
                  <Button type="submit">설정 메일 다시 보내기</Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
