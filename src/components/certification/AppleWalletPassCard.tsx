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
    badgeLabel: "추가 전",
    badgeVariant: "neutral",
    title: "iPhone의 Wallet에 인증 패스를 추가하세요",
    description: "제휴처에서 QR을 더 빠르게 꺼낼 수 있는 보조 인증 수단이에요.",
    secondaryDescription: "웹 인증 카드와 QR은 그대로 사용할 수 있어요.",
  },
  active: {
    badgeLabel: "사용 가능",
    badgeVariant: "primary",
    title: "Wallet 패스를 사용할 수 있어요",
    description: "정보가 바뀌었거나 기기에서 보이지 않을 때만 다시 받아 주세요.",
  },
  active_unavailable: {
    badgeLabel: "발급 일시 중단",
    badgeVariant: "warning",
    title: "기존 패스는 계속 사용할 수 있어요",
    description: "새로 받기는 잠시 중단됐지만 QR 검증과 폐기는 그대로 이용할 수 있어요.",
  },
  consent_required: {
    badgeLabel: "재동의 필요",
    badgeVariant: "warning",
    title: "변경된 이용 내용을 확인해 주세요",
    description: "다시 동의하고 최신 패스를 받기 전까지 기존 패스의 인증이 중단돼요.",
  },
  revoked: {
    badgeLabel: "폐기됨",
    badgeVariant: "warning",
    title: "이 패스는 더 이상 인증에 사용할 수 없어요",
    description: "필요하면 새 패스를 발급해 주세요.",
  },
  blocked: {
    badgeLabel: "설정 필요",
    badgeVariant: "warning",
    title: "Wallet 패스를 추가하려면 한 단계가 남았어요",
    description: "인증 카드 준비를 마치면 패스 발급이 열려요.",
  },
  error: {
    badgeLabel: "확인 필요",
    badgeVariant: "danger",
    title: "패스를 최신 정보로 갱신해 주세요",
    description: "패스를 다시 받으면 현재 회원 정보가 반영돼요.",
  },
  unavailable: {
    badgeLabel: "현재 이용 불가",
    badgeVariant: "neutral",
    title: "Wallet 발급을 잠시 이용할 수 없어요",
    description: "준비가 끝날 때까지 웹 인증 카드와 QR을 이용해 주세요.",
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
    return "최신 패스 받기";
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

function shouldUseOfficialBadge(
  status: AppleWalletPassStatus,
  consented: boolean,
  hasPrimaryHandler: boolean,
) {
  if (!hasPrimaryHandler) {
    return false;
  }
  if (status === "not_issued" || status === "revoked" || status === "consent_required") {
    return consented;
  }
  return false;
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
  const hasPrimaryHandler = Boolean(primaryHandler);
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
  const showOfficialBadge = shouldUseOfficialBadge(
    status,
    consented,
    hasPrimaryHandler,
  );
  const showButtonAction =
    !showOfficialBadge
    && !isUnavailable
    && (hasPrimaryHandler || (isBlocked && Boolean(blockerActionHref)));
  const showPassiveActionMessage =
    !showOfficialBadge && !showButtonAction && isUnavailable;
  const messageToneClass = isError
    ? "border-danger/20 bg-danger/10"
    : "border-warning/20 bg-warning/10";

  return (
    <Card
      tone="muted"
      padding="lg"
      className={cn("w-full", className)}
      aria-labelledby={detailsId}
      aria-describedby={`${detailsId}-description`}
    >
      <div className="flex flex-col gap-6 min-[820px]:grid min-[820px]:grid-cols-[minmax(0,1fr)_minmax(14rem,17rem)] min-[820px]:items-start min-[820px]:gap-8">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Apple Wallet</p>
            <Badge variant={config.badgeVariant}>{config.badgeLabel}</Badge>
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

          <div className="flex gap-3 rounded-card border border-border/80 bg-surface-inset p-4">
            <CheckIcon
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">필요한 정보만 담아요</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                이름·기수·캠퍼스·역할만 저장하고, 사진과 이메일은 넣지 않아요.
              </p>
            </div>
          </div>

          {issuedAtLabel ? (
            <p className="ui-caption text-muted-foreground">
              마지막 발급 <time dateTime={lastIssuedAt ?? undefined}>{issuedAtLabel}</time>
            </p>
          ) : null}

          {isIssueFlow ? (
            <div className="rounded-card border border-primary/15 bg-primary-soft/55 p-4">
              <div>
                <label
                  htmlFor={consentId}
                  className="flex cursor-pointer items-start gap-3 has-[:disabled]:cursor-not-allowed"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control">
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
                      className="inline-flex h-6 w-6 items-center justify-center rounded-[0.45rem] border border-strong bg-surface-control text-transparent shadow-flat transition-surface-emphasis duration-200 ease-out hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15"
                    >
                      <CheckIcon className="h-5 w-5 stroke-[2.4]" />
                    </span>
                  </span>
                  <span className="min-w-0 pt-2 text-sm font-semibold leading-6 text-foreground">
                    위 정보 저장에 동의합니다.
                  </span>
                </label>
                <p
                  id={consentDescriptionId}
                  className="ml-14 mt-1 text-sm leading-6 text-muted-foreground"
                >
                  동의는 이 패스를 발급하고 최신 상태로 유지하는 데 사용돼요.
                </p>
              </div>
            </div>
          ) : null}

          {(isBlocked || isError) && blockerMessage ? (
            <div
              className={cn(
                "flex gap-3 rounded-card border p-4 text-sm leading-6 text-foreground",
                messageToneClass,
              )}
              role="status"
            >
              <ExclamationTriangleIcon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  isError ? "text-danger" : "text-warning",
                )}
                aria-hidden="true"
              />
              <p>{blockerMessage}</p>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 min-[820px]:items-stretch min-[820px]:justify-start">
          {showOfficialBadge ? (
            <div className="flex min-h-12 w-full flex-col items-center justify-center gap-2 min-[820px]:items-stretch">
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center self-center rounded-[0.75rem] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default"
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
                  width={132}
                  height={48}
                  unoptimized
                  className="block h-auto w-[132px] max-w-full"
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
          ) : null}

          {showButtonAction ? (
            <Button
              className="w-full"
              variant={isError || status === "active" ? "secondary" : "primary"}
              href={isBlocked ? blockerActionHref ?? undefined : undefined}
              onClick={primaryHandler}
              disabled={resolvedPrimaryDisabled}
              loading={isPrimaryLoading}
              loadingText={buildPrimaryLoadingText(status)}
              ariaLabel={primaryLabel}
            >
              {primaryLabel}
            </Button>
          ) : null}

          {hasActivePass ? (
            <Button
              className="w-full border-transparent bg-transparent text-muted-foreground shadow-none hover:border-danger/20 hover:bg-danger/10 hover:text-danger"
              variant="ghost"
              onClick={onRevoke}
              disabled={!onRevoke}
              loading={pendingAction === "revoke"}
              loadingText="패스 폐기 중"
              aria-describedby={detailsId}
            >
              이 패스 폐기
            </Button>
          ) : null}

          {showPassiveActionMessage ? (
            <p className="text-sm leading-6 text-muted-foreground" aria-live="polite">
              {hasActivePass
                ? "지금은 기존 패스를 계속 사용하거나 폐기할 수 있어요."
                : "이용이 다시 시작될 때까지 웹 QR 인증을 사용해 주세요."}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
