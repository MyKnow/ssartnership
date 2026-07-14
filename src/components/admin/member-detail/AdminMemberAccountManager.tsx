"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import type { MemberEmailLoginTransition } from "@/lib/member-email-login-transition";

type FormAction = (formData: FormData) => void | Promise<void>;

export default function AdminMemberAccountManager({
  member,
  updateAction,
  deleteAction,
  emailLoginTransitionAction,
  canUpdate,
  canDelete,
}: {
  member: {
    id: string;
    displayName: string;
    campus: string;
    generation: number;
    mmUsername: string;
    manualLoginId: string | null;
    mustChangePassword: boolean;
    email?: string | null;
    emailVerifiedAt?: string | null;
    hasMattermostAccount: boolean;
    mattermostLoginDisabledAt: string | null;
    mattermostLoginDisabledReason: string | null;
    emailLoginTransition?: MemberEmailLoginTransition | null;
  };
  updateAction: FormAction;
  deleteAction: FormAction;
  emailLoginTransitionAction: FormAction;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  if (!canUpdate && !canDelete) {
    return null;
  }

  return (
    <Card tone="default" className="grid min-w-0 gap-4">
      <AdminSectionHeading
        title="계정 관리"
        description="수정과 삭제는 회원 상세에서만 처리합니다."
      />

      {canUpdate ? (
        <form action={updateAction} className="grid min-w-0 gap-3">
          <input type="hidden" name="id" value={member.id} />
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            표시 이름
            <Input name="displayName" defaultValue={member.displayName} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            캠퍼스
            <Input name="campus" defaultValue={member.campus} />
          </label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
              기수
              <Input
                type="number"
                min={0}
                max={99}
                name="generation"
                defaultValue={member.generation}
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
              비밀번호 상태
              <Select
                name="mustChangePassword"
                defaultValue={member.mustChangePassword ? "true" : "false"}
              >
                <option value="false">정상</option>
                <option value="true">변경 필요</option>
              </Select>
            </label>
          </div>
          <SubmitButton pendingText="저장 중" className="w-full">
            회원 정보 저장
          </SubmitButton>
        </form>
      ) : null}

      {canUpdate && member.hasMattermostAccount ? (
        <section className="grid gap-3 border-t border-border/70 pt-4">
          <AdminSectionHeading
            title="이메일 로그인 전환"
            description="MM 연결 이력은 유지합니다. 이 기능은 운영자가 회원 신원을 별도 확인한 뒤 이메일 로그인만 추가하는 복구 절차입니다."
          />
          <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
            <p>
              MM 로그인: {member.mattermostLoginDisabledAt ? "사용 중단됨" : "사용 중"}
              {member.mattermostLoginDisabledReason
                ? ` · ${member.mattermostLoginDisabledReason === "generation_completed" ? "기수 수료" : member.mattermostLoginDisabledReason === "member_departed" ? "중도 이탈" : "외부 조회 미발견"}`
                : ""}
            </p>
            {member.emailLoginTransition ? (
              <p className="mt-1">
                이메일 전환: {member.emailLoginTransition.status === "completed"
                  ? "완료"
                  : member.emailLoginTransition.status === "email_sent"
                    ? "설정 링크 발송됨"
                    : "설정 링크 발송 대기"}
              </p>
            ) : null}
          </div>

          {member.emailLoginTransition?.status === "completed" ? (
            <p className="text-sm text-muted-foreground">
              이메일 로그인 전환을 완료했습니다. 비밀번호 재설정은 일반 이메일 재설정 흐름을 사용해 주세요.
            </p>
          ) : (
            <form
              action={emailLoginTransitionAction}
              onSubmit={(event) => {
                if (!window.confirm("MM 로그인을 중단하고 이메일 설정 링크를 발송하시겠습니까?")) {
                  event.preventDefault();
                }
              }}
              className="grid min-w-0 gap-3"
            >
              <input type="hidden" name="id" value={member.id} />
              <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
                인증 이메일
                <Input
                  type="email"
                  name="email"
                  required
                  defaultValue={member.emailLoginTransition?.candidateEmail ?? member.email ?? ""}
                  autoComplete="email"
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
                MM 이용 중단 사유
                <Select
                  name="reason"
                  defaultValue={member.mattermostLoginDisabledReason ?? "member_departed"}
                >
                  <option value="member_departed">중도 이탈</option>
                  <option value="generation_completed">기수 수료</option>
                  <option value="provider_not_found">외부 조회 미발견</option>
                </Select>
              </label>
              <p className="text-xs leading-5 text-muted-foreground">
                링크 수신은 이메일 소유만 증명하며 회원 신원 확인을 대신하지 않습니다. 기존 인증 이메일이 있는 회원은 같은 주소만 사용할 수 있습니다.
              </p>
              <label className="flex items-start gap-2 text-sm leading-5 text-foreground">
                <input type="checkbox" name="identityVerified" value="true" required className="mt-1 size-4" />
                <span>대상 회원의 신원을 별도 확인했고, 입력한 이메일 소유자를 확인했습니다.</span>
              </label>
              <SubmitButton pendingText="링크 발송 중" className="w-full">
                이메일 설정 링크 발송
              </SubmitButton>
            </form>
          )}
        </section>
      ) : null}

      {canDelete ? (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `정말 ${member.displayName}(${member.manualLoginId ?? `@${member.mmUsername}`}) 회원을 삭제하시겠습니까?`,
              )
            ) {
              event.preventDefault();
            }
          }}
          className="border-t border-border/70 pt-4"
        >
          <input type="hidden" name="id" value={member.id} />
          <SubmitButton variant="danger" pendingText="삭제 중" className="w-full">
            회원 삭제
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
