"use client";

import { CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { useId, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type AppleWalletPassStatus =
  | "not_issued"
  | "active"
  | "active_unavailable"
  | "consent_required"
  | "revoked"
  | "blocked"
  | "error"
  | "unavailable";

type PendingAction = "issue" | "download" | "revoke" | null;

type AppleWalletPassCardProps = {
  status: AppleWalletPassStatus;
  lastIssuedAt?: string | null;
  blockerMessage?: string | null;
  blockerActionHref?: string | null;
  blockerActionLabel?: string | null;
  pendingAction?: PendingAction;
  onIssue?: () => void | Promise<void>;
  onDownload?: () => void | Promise<void>;
  onRevoke?: () => void | Promise<void>;
  className?: string;
};

type StatusConfig = {
  badgeLabel: string;
  badgeVariant: "neutral" | "primary" | "warning" | "danger";
  title: string;
  description: string;
  secondaryDescription?: string;
};

const STATUS_CONFIG: Record<AppleWalletPassStatus, StatusConfig> = {
  not_issued: {
    badgeLabel: "미발급",
    badgeVariant: "neutral",
    title: "Apple Wallet 패스를 아직 발급하지 않았어요.",
    description: "제휴처에서 인증 정보를 더 빠르게 보여주려면 패스를 추가해 주세요.",
    secondaryDescription: "동의 후 발급하면 이 기기에서 바로 Wallet으로 이동할 수 있어요.",
  },
  active: {
    badgeLabel: "발급됨",
    badgeVariant: "primary",
    title: "Apple Wallet 패스가 준비되어 있어요.",
    description: "기기에서 패스가 보이지 않거나 정보가 갱신되지 않으면 다시 받아 주세요.",
    secondaryDescription: "더 이상 사용하지 않을 때는 현재 패스를 폐기하고 다시 발급할 수 있어요.",
  },
  active_unavailable: {
    badgeLabel: "재발급 중단",
    badgeVariant: "warning",
    title: "기존 Apple Wallet 패스는 계속 관리할 수 있어요.",
    description: "신규 발급과 패스 다시 받기는 잠시 중단되었어요.",
    secondaryDescription: "기기에 남아 있는 패스의 QR 검증과 이 화면의 패스 폐기는 계속 이용할 수 있어요.",
  },
  consent_required: {
    badgeLabel: "재동의 필요",
    badgeVariant: "warning",
    title: "Wallet 데이터 이용 내용이 변경되었어요.",
    description: "변경된 저장 항목과 이용 목적을 확인한 뒤 다시 동의해 주세요.",
    secondaryDescription: "다시 동의하기 전에는 기존 패스로 인증할 수 없습니다.",
  },
  revoked: {
    badgeLabel: "회수됨",
    badgeVariant: "warning",
    title: "기존 Apple Wallet 패스를 더 이상 사용할 수 없어요.",
    description: "최신 정보로 다시 발급해 주세요.",
    secondaryDescription: "이전 패스는 제휴처 인증용으로 사용되지 않습니다.",
  },
  blocked: {
    badgeLabel: "설정 필요",
    badgeVariant: "warning",
    title: "지금은 Apple Wallet 패스를 발급할 수 없어요.",
    description: "인증 카드 준비가 완료된 뒤에 패스를 만들 수 있어요.",
  },
  error: {
    badgeLabel: "오류",
    badgeVariant: "danger",
    title: "Apple Wallet 패스를 불러오지 못했어요.",
    description: "잠시 후 다시 시도해 주세요.",
    secondaryDescription: "문제가 계속되면 운영진에 문의해 주세요.",
  },
  unavailable: {
    badgeLabel: "준비 중",
    badgeVariant: "neutral",
    title: "Apple Wallet 발급 기능을 준비하고 있어요.",
    description: "개발자 인증서와 배포 설정이 완료되면 이 화면에서 바로 발급할 수 있어요.",
    secondaryDescription: "준비 중인 동안에는 기존 QR 인증 카드를 계속 이용해 주세요.",
  },
};

function formatIssuedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function buildPrimaryButtonLabel(status: AppleWalletPassStatus) {
  if (status === "active") {
    return "패스 다시 받기";
  }
  if (status === "active_unavailable") {
    return "패스 다시 받기 중단";
  }
  if (status === "error") {
    return "다시 시도";
  }
  if (status === "blocked") {
    return "설정 후 이용 가능";
  }
  if (status === "unavailable") {
    return "발급 준비 중";
  }
  return "Apple Wallet 패스 발급하기";
}

function buildPrimaryLoadingText(status: AppleWalletPassStatus) {
  if (status === "active" || status === "active_unavailable") {
    return "패스 준비 중";
  }
  return "패스 발급 중";
}

export default function AppleWalletPassCard({
  status,
  lastIssuedAt = null,
  blockerMessage = null,
  blockerActionHref = null,
  blockerActionLabel = null,
  pendingAction = null,
  onIssue,
  onDownload,
  onRevoke,
  className,
}: AppleWalletPassCardProps) {
  const [consented, setConsented] = useState(false);
  const detailsId = useId();
  const consentId = useId();
  const consentDescriptionId = `${consentId}-description`;
  const config = STATUS_CONFIG[status];
  const issuedAtLabel = lastIssuedAt ? formatIssuedAt(lastIssuedAt) : null;
  const isIssueFlow =
    status === "not_issued" ||
    status === "revoked" ||
    status === "consent_required";
  const isBlocked = status === "blocked";
  const isActive = status === "active";
  const hasActivePass = isActive || status === "active_unavailable";
  const isUnavailable =
    status === "unavailable" || status === "active_unavailable";
  const isError = status === "error";
  const primaryHandler = hasActivePass ? onDownload : onIssue;
  const primaryDisabled = isUnavailable
    || (isBlocked && !blockerActionHref)
    || !primaryHandler
    || (isIssueFlow && !consented);
  const resolvedPrimaryDisabled = isBlocked && blockerActionHref
    ? false
    : primaryDisabled;
  const primaryLabel = isBlocked && blockerActionLabel
    ? blockerActionLabel
    : buildPrimaryButtonLabel(status);
  const isPrimaryLoading =
    pendingAction === (hasActivePass ? "download" : "issue");
  const showOfficialBadge =
    !isBlocked
    && !isUnavailable
    && Boolean(primaryHandler)
    && (!isIssueFlow || consented);

  return (
    <Card
      tone="default"
      padding="lg"
      className={cn("@container w-full", className)}
      aria-labelledby={detailsId}
      aria-describedby={`${detailsId}-description`}
    >
      <div className="flex flex-col gap-6 @min-[690px]:grid @min-[690px]:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] @min-[690px]:items-start @min-[690px]:gap-8">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={config.badgeVariant}>{config.badgeLabel}</Badge>
            <p className="text-sm font-semibold text-foreground">Apple Wallet</p>
          </div>

          <div className="space-y-2">
            <h2 id={detailsId} className="text-lg font-semibold text-foreground sm:text-xl">
              {config.title}
            </h2>
            <div id={`${detailsId}-description`} className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>{config.description}</p>
              {config.secondaryDescription ? <p>{config.secondaryDescription}</p> : null}
            </div>
          </div>

          <div className="rounded-card border border-border/80 bg-surface-inset p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">
              개인정보 안내
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              이름·기수·캠퍼스·역할이 패스에 저장되며 사진·이메일은 저장되지 않음
            </p>
          </div>

          {issuedAtLabel ? (
            <p className="text-sm text-muted-foreground">
              최근 발급 {issuedAtLabel}
            </p>
          ) : null}

          {isIssueFlow ? (
            <div className="rounded-card border border-border/80 bg-surface-inset p-4">
              <div>
                <label
                  htmlFor={consentId}
                  className="flex cursor-pointer items-start gap-3 has-[:disabled]:cursor-not-allowed"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                    <input
                      id={consentId}
                      type="checkbox"
                      className="peer sr-only"
                      checked={consented}
                      onChange={(event) => setConsented(event.target.checked)}
                      aria-describedby={consentDescriptionId}
                    />
                    <span
                      aria-hidden="true"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-control text-transparent shadow-flat transition-surface-emphasis duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover-shadow-raised peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:border-primary/60 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15"
                    >
                      <CheckIcon className="h-5 w-5 stroke-[2.4]" />
                    </span>
                  </span>
                  <span className="min-w-0 pt-2 text-sm font-semibold leading-6 text-foreground">
                    개인정보 저장 내용을 확인했고 Apple Wallet 패스 발급에 동의합니다.
                  </span>
                </label>
                <p
                  id={consentDescriptionId}
                  className="ml-14 mt-1 text-sm leading-6 text-muted-foreground"
                >
                  발급 전에 저장 항목을 다시 확인해 주세요.
                </p>
              </div>
            </div>
          ) : null}

          {(isBlocked || isError) && blockerMessage ? (
            <div
              className="flex gap-3 rounded-card border border-warning/20 bg-warning/10 p-4 text-sm leading-6 text-foreground"
              role="status"
            >
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
              <p>{blockerMessage}</p>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:items-stretch md:justify-start">
          {showOfficialBadge ? (
            <div className="flex min-h-12 w-full flex-col items-center justify-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[0.75rem] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default"
                onClick={() => {
                  void primaryHandler?.();
                }}
                disabled={resolvedPrimaryDisabled || isPrimaryLoading}
                aria-label={primaryLabel}
                aria-busy={isPrimaryLoading || undefined}
              >
                <Image
                  src="/apple-wallet-add-to-wallet-ko.svg"
                  alt=""
                  width={97}
                  height={35}
                  unoptimized
                  className="block h-[35.068px] w-[96.995px] max-w-full"
                />
              </button>
              {isPrimaryLoading ? (
                <span
                  className="text-sm font-medium text-muted-foreground"
                  role="status"
                >
                  {buildPrimaryLoadingText(status)}
                </span>
              ) : null}
            </div>
          ) : (
            <Button
              className="w-full"
              href={isBlocked ? blockerActionHref ?? undefined : undefined}
              onClick={primaryHandler}
              disabled={resolvedPrimaryDisabled}
              loading={isPrimaryLoading}
              loadingText={buildPrimaryLoadingText(status)}
              ariaLabel={primaryLabel}
            >
              {primaryLabel}
            </Button>
          )}

          {hasActivePass ? (
            <Button
              className="w-full"
              variant="danger"
              onClick={onRevoke}
              disabled={!onRevoke}
              loading={pendingAction === "revoke"}
              loadingText="패스 폐기 중"
              aria-describedby={detailsId}
            >
              패스 폐기
            </Button>
          ) : null}

          {isUnavailable ? (
            <p className="text-sm leading-6 text-muted-foreground" aria-live="polite">
              {hasActivePass
                ? "발급 기능을 다시 열기 전까지 기존 패스의 QR 검증과 폐기만 이용할 수 있습니다."
                : "Apple 개발자 인증과 Wallet 배포 설정이 끝나면 발급 버튼이 활성화됩니다."}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
