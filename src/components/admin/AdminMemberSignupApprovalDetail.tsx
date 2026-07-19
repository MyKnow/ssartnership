import Image from "next/image";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import type { MattermostSignupApprovalRequestSummary } from "@/lib/mm-signup-approval";
import { MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS } from "@/lib/member-manual-import/options";
import { formatSsafyYearLabel, getCurrentSsafyYear } from "@/lib/ssafy-year";

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

export default function AdminMemberSignupApprovalDetail({
  request,
  approveAction,
  rejectAction,
  error,
}: {
  request: MattermostSignupApprovalRequestSummary;
  approveAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
  error?: string | null;
}) {
  const generationOptions = Array.from(
    { length: Math.min(99, Math.max(1, getCurrentSsafyYear())) + 1 },
    (_, generation) => generation,
  );
  const isPending = request.status === "pending";

  return (
    <div className="grid gap-6">
      <AdminPageHeader
        eyebrow="Member onboarding"
        title="가입 승인 요청 검토"
        description="Mattermost 계정은 이미 인증되었지만, 닉네임에서 이름·기수·캠퍼스를 자동 확정하지 못한 요청입니다."
        actions={
          <Link
            href="/admin/member-signup-requests"
            className="inline-flex min-h-11 items-center rounded-[1rem] border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-inset"
          >
            목록으로
          </Link>
        }
      />

      {error ? <FormMessage variant="error">{error}</FormMessage> : null}

      <Card tone="elevated" className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isPending ? "warning" : request.status === "approved" ? "success" : "danger"}>
            {isPending ? "승인 대기" : request.status === "approved" ? "승인 완료" : "반려"}
          </Badge>
          <span className="text-sm text-muted-foreground">신청 {formatDate(request.createdAt)}</span>
        </div>
        <dl className="grid gap-3 rounded-card border border-border bg-surface-inset p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Mattermost ID</dt>
            <dd className="mt-1 font-semibold text-foreground">@{request.mmUsername}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mattermost 표시 이름</dt>
            <dd className="mt-1 break-words font-semibold text-foreground">{request.mattermostDisplayName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">신청 기수</dt>
            <dd className="mt-1 font-semibold text-foreground">{formatSsafyYearLabel(request.requestedGeneration)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">인증 Sender</dt>
            <dd className="mt-1 font-semibold text-foreground">{formatSsafyYearLabel(request.senderGeneration)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">파싱 실패 사유</dt>
            <dd className="mt-1 font-semibold text-foreground">{PARSE_REASON_LABELS[request.parseExclusionReason ?? ""] ?? "수동 확인 필요"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">약관 동의</dt>
            <dd className="mt-1 font-semibold text-foreground">필수 약관 동의 완료 · 마케팅 {request.marketingPolicyChecked ? "동의" : "미동의"}</dd>
          </div>
        </dl>
      </Card>

      {isPending && request.hasProfileImage ? (
        <Card className="grid gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Mattermost 프로필 사진</h2>
            <p className="mt-1 text-sm text-muted-foreground">승인 요청 권한을 확인한 관리자만 임시 이미지를 볼 수 있습니다.</p>
          </div>
          <Image
            src={`/api/admin/member-signup-requests/${encodeURIComponent(request.id)}/profile-image`}
            alt="Mattermost 프로필 사진"
            width={160}
            height={160}
            unoptimized
            className="h-40 w-40 rounded-card border border-border object-cover"
          />
        </Card>
      ) : null}

      {isPending ? (
        <>
          <Card className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">부족한 회원 정보 입력</h2>
              <p className="mt-1 text-sm text-muted-foreground">승인과 동시에 회원 계정이 생성됩니다. 비밀번호는 화면에 표시하지 않습니다.</p>
            </div>
            <form action={approveAction} className="grid gap-4">
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid gap-2 text-sm font-medium text-foreground">
                이름
                <Input name="displayName" required maxLength={128} defaultValue={request.mattermostDisplayName} placeholder="홍길동" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  기수
                  <Select name="generation" defaultValue={String(request.requestedGeneration)} required>
                    {generationOptions.map((generation) => (
                      <option key={generation} value={generation}>{formatSsafyYearLabel(generation)}</option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  캠퍼스
                  <Select name="campus" defaultValue="">
                    <option value="">운영진이면 비워 두세요</option>
                    {MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS.map((campus) => (
                      <option key={campus.value} value={campus.value}>{campus.label}</option>
                    ))}
                  </Select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <SubmitButton pendingText="승인 중">회원가입 승인</SubmitButton>
                <Button href="/admin/member-signup-requests" variant="secondary">취소</Button>
              </div>
            </form>
          </Card>

          <Card className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">승인하지 않기</h2>
              <p className="mt-1 text-sm text-muted-foreground">반려 사유를 남기면 요청의 비밀번호 material은 즉시 삭제됩니다.</p>
            </div>
            <form action={rejectAction} className="grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <textarea name="reason" required maxLength={500} className="min-h-24 rounded-card border border-border bg-surface px-3 py-2 text-sm text-foreground" placeholder="반려 사유를 입력해 주세요." />
              <SubmitButton variant="danger" pendingText="반려 중">반려</SubmitButton>
            </form>
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">이미 처리된 요청입니다.</p>
        </Card>
      )}
    </div>
  );
}
