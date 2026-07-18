"use client";

import { useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminFormAction } from "@/components/admin/admin-form-actions";
import type {
  MattermostSenderMetadata,
  MattermostSenderStatus,
} from "@/lib/mattermost-senders/types";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import {
  parseMattermostSenderCredentialInput,
  type MattermostSenderCredentialFieldErrors,
} from "@/lib/mattermost-senders/validation";

const STATUS_LABELS: Record<MattermostSenderStatus, string> = {
  pending: "검증 대기",
  active: "활성",
  superseded: "교체됨",
  disabled: "비활성",
};

const STATUS_VARIANTS: Record<
  MattermostSenderStatus,
  "success" | "warning" | "neutral" | "danger"
> = {
  pending: "warning",
  active: "success",
  superseded: "neutral",
  disabled: "danger",
};

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

function formatLastTest(sender: MattermostSenderMetadata) {
  if (!sender.lastTestedAt) return "아직 테스트하지 않음";
  if (sender.lastErrorCode) return "테스트 실패";
  return sender.status === "active" ? "테스트 성공" : "최근 테스트 완료";
}

export default function MattermostSenderManager({
  senders,
  loadError,
  saveAction,
  testAction,
  disableAction,
  generation,
  anchorId,
}: {
  senders: MattermostSenderMetadata[];
  loadError?: boolean;
  saveAction: AdminFormAction;
  testAction: AdminFormAction;
  disableAction: AdminFormAction;
  generation?: number;
  anchorId?: string;
}) {
  const [fieldErrors, setFieldErrors] = useState<MattermostSenderCredentialFieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const generationLabel = typeof generation === "number" ? formatSsafyYearLabel(generation) : null;
  const visibleSenders = typeof generation === "number"
    ? senders.filter((sender) => sender.generation === generation)
    : senders;

  function focusFirstInvalidField(errors: MattermostSenderCredentialFieldErrors) {
    const fieldName = (["generation", "loginId", "password"] as const).find(
      (name) => errors[name],
    );
    if (!fieldName) return;
    requestAnimationFrame(() => {
      const element = formRef.current?.elements.namedItem(fieldName);
      if (element instanceof HTMLElement) {
        element.focus();
      }
    });
  }

  function validateCandidateForm(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = parseMattermostSenderCredentialInput({
      generation: formData.get("generation")?.toString(),
      loginId: formData.get("loginId")?.toString(),
      password: formData.get("password")?.toString(),
    });
    if (parsed.ok) {
      setFieldErrors({});
      return;
    }
    event.preventDefault();
    setFieldErrors(parsed.fieldErrors);
    focusFirstInvalidField(parsed.fieldErrors);
  }

  return (
    <Card id={anchorId ?? (generationLabel ? `mattermost-sender-${generation}` : "mattermost-sender")} tone="elevated" className="grid gap-6">
      <div className="grid gap-2">
        <p className="ui-kicker">{generationLabel ? `${generationLabel} 운영` : "Super Admin only"}</p>
        <h2 className="text-lg font-semibold text-foreground">Mattermost Sender</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {generationLabel
            ? `${generationLabel} 가입·알림에 사용할 Sender를 관리합니다. 로그인 정보는 서버에서 암호화되고 테스트 DM 성공 후에만 활성화됩니다.`
            : "기수별 Sender 로그인 정보는 서버에서 암호화됩니다. 저장 후 테스트 DM이 성공해야만 활성화되며, 기존 활성 Sender는 교체가 확정될 때까지 유지됩니다."}
        </p>
      </div>

      {loadError ? (
        <FormMessage variant="error">
          Sender 목록을 불러오지 못했습니다. 데이터베이스 마이그레이션과 서버 설정을 확인해 주세요.
        </FormMessage>
      ) : null}

      <form
        ref={formRef}
        action={saveAction}
        className="grid gap-4 rounded-3xl border border-border bg-surface-inset p-4 sm:p-5"
        onSubmit={validateCandidateForm}
      >
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {generationLabel ? `${generationLabel} 신규 또는 교체 후보 등록` : "신규 또는 교체 후보 등록"}
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            {generationLabel
              ? "팀과 채널은 " + generationLabel + " 기준으로 자동 계산됩니다. 로그인 ID와 비밀번호는 저장 이후 다시 표시되지 않습니다."
              : "팀과 채널은 기수 기준으로 자동 계산됩니다. 로그인 ID와 비밀번호는 저장 이후 다시 표시되지 않습니다."}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(7rem,0.45fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            기수
            <Input
              type="number"
              name="generation"
              min={1}
              max={99}
              inputMode="numeric"
              defaultValue={generation}
              readOnly={generation !== undefined}
              aria-invalid={Boolean(fieldErrors.generation)}
              aria-describedby={fieldErrors.generation ? "mattermost-sender-generation-error" : undefined}
              required
            />
            {fieldErrors.generation ? <span id="mattermost-sender-generation-error" className="text-xs font-normal text-danger">{fieldErrors.generation}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Mattermost 로그인 ID
            <Input
              name="loginId"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.loginId)}
              aria-describedby={fieldErrors.loginId ? "mattermost-sender-login-id-error" : undefined}
              required
            />
            {fieldErrors.loginId ? <span id="mattermost-sender-login-id-error" className="text-xs font-normal text-danger">{fieldErrors.loginId}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Mattermost 비밀번호
            <Input
              type="password"
              name="password"
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "mattermost-sender-password-error" : undefined}
              required
            />
            {fieldErrors.password ? <span id="mattermost-sender-password-error" className="text-xs font-normal text-danger">{fieldErrors.password}</span> : null}
          </label>
          <SubmitButton pendingText="암호화해 저장 중" className="lg:mb-0.5">
            후보 저장
          </SubmitButton>
        </div>
      </form>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {generationLabel ? `${generationLabel} 등록된 Sender` : "등록된 Sender"}
          </h3>
          <p className="text-xs text-muted-foreground">식별자 일부와 검증 상태만 표시합니다.</p>
        </div>
        {visibleSenders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-5 text-sm text-muted-foreground">
            {generationLabel
              ? `${generationLabel}에 등록된 Sender가 없습니다. 위에서 후보를 저장해 주세요.`
              : "등록된 Sender가 없습니다. 기수를 입력해 후보를 먼저 저장해 주세요."}
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleSenders.map((sender) => {
              const canTest = sender.status === "pending";
              const canDisable = sender.status === "pending" || sender.status === "active";
              const confirmationText = `${sender.generation}기 비활성화`;
              return (
                <article
                  key={sender.id}
                  className="grid gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="text-base font-semibold text-foreground">{sender.generation}기 · {sender.loginIdHint}</p>
                      <p className="text-xs text-muted-foreground">
                        최근 검증 {formatTimestamp(sender.verifiedAt)} · {formatLastTest(sender)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={STATUS_VARIANTS[sender.status]}>{STATUS_LABELS[sender.status]}</Badge>
                      {sender.senderUsernameHint ? <Badge variant="neutral">{sender.senderUsernameHint}</Badge> : null}
                    </div>
                  </div>

                  {sender.status === "pending" && sender.expiresAt ? (
                    <p className="rounded-2xl bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
                      후보 만료 예정: {formatTimestamp(sender.expiresAt)}. 테스트 DM 성공 전에는 기존 활성 Sender가 계속 사용됩니다.
                    </p>
                  ) : null}

                  {sender.lastErrorCode ? (
                    <p className="rounded-2xl bg-danger/10 px-3 py-2 text-xs leading-5 text-danger">
                      마지막 테스트는 완료되지 않았습니다. 안전한 오류 코드: {sender.lastErrorCode}
                    </p>
                  ) : null}

                  {(canTest || canDisable) ? (
                    <div className="grid gap-3 border-t border-border pt-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
                      {canTest ? (
                        <form action={testAction}>
                          <input type="hidden" name="candidateId" value={sender.id} />
                          <SubmitButton pendingText="테스트 DM 발송 중" variant="secondary">
                            테스트 후 활성화
                          </SubmitButton>
                        </form>
                      ) : <div />}
                      {canDisable ? (
                        <form action={disableAction} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                            비활성화하려면 <span className="font-semibold text-foreground">{confirmationText}</span> 입력
                            <Input name="confirmationText" placeholder={confirmationText} autoComplete="off" required />
                          </label>
                          <input type="hidden" name="candidateId" value={sender.id} />
                          <SubmitButton pendingText="비활성화 중" variant="danger">
                            비활성화
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
