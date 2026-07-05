"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
import Select from "@/components/ui/Select";
import StatsRow from "@/components/ui/StatsRow";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  PARTNER_NOTIFICATION_CENTER_SCOPE_LABEL,
  type PartnerNotificationCategory,
  type PartnerNotificationCenterData,
  type PartnerNotificationEntry,
  type PartnerNotificationStatus,
} from "@/lib/partner-notifications";
import {
  derivePartnerNotificationUiModel,
  filterPartnerNotificationUiModels,
  PARTNER_NOTIFICATION_PRIORITY_LABELS,
  PARTNER_NOTIFICATION_PURPOSE_LABELS,
  type PartnerNotificationPriority,
  type PartnerNotificationProgressStep,
  type PartnerNotificationPurpose,
  type PartnerNotificationReadState,
  type PartnerNotificationUiFilters,
  type PartnerNotificationUiModel,
  type PartnerNotificationUiType,
  summarizePartnerNotificationUiModels,
} from "@/lib/partner-notification-ui";

type NotificationFilter = PartnerNotificationCategory | "all";
type PartnerNotificationMutationResponse = {
  ok?: boolean;
  message?: string;
  summary?: { unreadCount?: number };
};

const categoryOptions: Array<{
  value: NotificationFilter;
  label: string;
}> = [
  { value: "all", label: "전체 카테고리" },
  { value: "request", label: "변경 요청" },
  { value: "plan", label: "플랜" },
  { value: "review", label: "리뷰" },
  { value: "operation", label: "운영" },
];

const purposeOptions: Array<{
  value: PartnerNotificationPurpose | "all";
  label: string;
}> = [
  { value: "all", label: "전체 목적" },
  { value: "action", label: PARTNER_NOTIFICATION_PURPOSE_LABELS.action },
  { value: "information", label: PARTNER_NOTIFICATION_PURPOSE_LABELS.information },
];

const priorityOptions: Array<{
  value: PartnerNotificationPriority | "all";
  label: string;
}> = [
  { value: "all", label: "전체 우선순위" },
  { value: "critical", label: PARTNER_NOTIFICATION_PRIORITY_LABELS.critical },
  { value: "high", label: PARTNER_NOTIFICATION_PRIORITY_LABELS.high },
  { value: "medium", label: PARTNER_NOTIFICATION_PRIORITY_LABELS.medium },
  { value: "low", label: PARTNER_NOTIFICATION_PRIORITY_LABELS.low },
];

const readStateOptions: Array<{
  value: PartnerNotificationReadState | "all";
  label: string;
}> = [
  { value: "all", label: "전체 읽음" },
  { value: "unread", label: "미확인" },
  { value: "read", label: "확인됨" },
];

const periodOptions: Array<{
  value: PartnerNotificationUiFilters["period"];
  label: string;
}> = [
  { value: "all", label: "전체 기간" },
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
];

const priorityBadgeVariants: Record<PartnerNotificationPriority, "danger" | "warning" | "primary" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "neutral",
};

const purposeBadgeVariants: Record<PartnerNotificationPurpose, "warning" | "neutral"> = {
  action: "warning",
  information: "neutral",
};

const progressStepClassNames: Record<PartnerNotificationProgressStep["state"], string> = {
  done: "bg-success",
  current: "bg-primary",
  next: "bg-border",
  blocked: "bg-danger",
};

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Select>
    </label>
  );
}

async function parsePartnerNotificationMutationResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as PartnerNotificationMutationResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "알림을 처리하지 못했습니다.");
  }

  return data;
}

function updateNotificationReadState(
  items: PartnerNotificationEntry[],
  notificationIds: string[],
  readAt: string,
) {
  const targets = new Set(notificationIds);
  return items.map((item) =>
    item.notificationId && targets.has(item.notificationId)
      ? {
          ...item,
          readAt,
          isUnread: false,
          tone: item.tone === "primary" ? "neutral" : item.tone,
          badgeLabel: item.badgeLabel.includes("새") ? "확인됨" : item.badgeLabel,
        }
      : item,
  );
}

function removeNotifications(
  items: PartnerNotificationEntry[],
  notificationIds: string[],
) {
  const targets = new Set(notificationIds);
  return items.filter((item) => !item.notificationId || !targets.has(item.notificationId));
}

function NotificationProgress({
  steps,
}: {
  steps: PartnerNotificationProgressStep[];
}) {
  return (
    <div className="hidden min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground md:flex">
      {steps.map((step, index) => (
        <div key={`${step.label}:${index}`} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", progressStepClassNames[step.state])}
          />
          <span className={cn("max-w-24 truncate", step.state === "current" ? "text-foreground" : null)}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function NotificationCard({
  model,
  pending,
  onMarkRead,
  onDelete,
}: {
  model: PartnerNotificationUiModel;
  pending: boolean;
  onMarkRead: (model: PartnerNotificationUiModel) => void;
  onDelete: (model: PartnerNotificationUiModel) => void;
}) {
  const { item } = model;
  const isAction = model.purpose === "action";
  const canMutate = Boolean(item.notificationId);
  const canMarkRead = canMutate && model.readState === "unread";
  const canDelete = canMutate && isAction;

  return (
    <Card
      tone="default"
      padding="none"
      className={cn(
        "overflow-hidden border-l-4",
        isAction ? "border-l-warning bg-surface-elevated" : "border-l-border bg-surface",
        model.priority === "critical" ? "border-l-danger" : null,
      )}
    >
      <div className="grid min-w-0 gap-3 p-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
            isAction
              ? "border-warning/20 bg-warning/10 text-warning"
              : "border-border bg-surface-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {model.avatarLabel}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant={purposeBadgeVariants[model.purpose]}>{model.purposeLabel}</Badge>
            <Badge variant="neutral">{model.typeLabel}</Badge>
            <Badge variant="primary">{model.statusLabel}</Badge>
            <Badge variant={priorityBadgeVariants[model.priority]}>{model.priorityLabel}</Badge>
            <time
              className="ml-auto min-w-0 truncate text-xs font-medium text-muted-foreground"
              dateTime={item.createdAt}
              title={model.absoluteTime}
            >
              {model.relativeTime}
            </time>
          </div>

          <div className="grid min-w-0 gap-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-sm font-semibold leading-5 text-foreground sm:text-base">
                {item.title}
              </h3>
              <p className="line-clamp-2 text-sm leading-5 text-muted-foreground sm:line-clamp-1">
                {item.body}
              </p>
            </div>
            <div className="min-w-0 text-xs text-muted-foreground lg:text-right">
              <p className="truncate">대상 {model.targetLabel}</p>
              <p className="truncate">현재 단계 · {model.currentStepLabel}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <NotificationProgress steps={model.progressSteps} />
            <p className="line-clamp-1 min-w-0 text-xs text-muted-foreground">
              다음 · {model.nextStepLabel}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:w-auto sm:shrink-0">
          {item.href ? (
            <PartnerPendingButtonLink
              href={item.href}
              variant={isAction ? "soft" : "secondary"}
              size="sm"
              className="w-full sm:w-auto"
              showSpinner
            >
              {model.ctaLabel}
            </PartnerPendingButtonLink>
          ) : null}
          {canMarkRead || canDelete ? (
            <div className="flex min-w-0 gap-2 sm:justify-end">
              {canMarkRead ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-9 flex-1 px-3 text-xs sm:flex-none"
                  loading={pending}
                  loadingText="처리 중"
                  disabled={pending}
                  onClick={() => onMarkRead(model)}
                >
                  읽음 처리
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="min-h-9 flex-1 px-3 text-xs sm:flex-none"
                  loading={pending}
                  loadingText="삭제 중"
                  disabled={pending}
                  onClick={() => onDelete(model)}
                >
                  삭제
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function PriorityNotificationRow({ model }: { model: PartnerNotificationUiModel }) {
  const { item } = model;

  return (
    <div className="grid min-w-0 gap-3 rounded-[1rem] border border-border/80 bg-surface-inset px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={purposeBadgeVariants[model.purpose]}>{model.purposeLabel}</Badge>
        <Badge variant={priorityBadgeVariants[model.priority]}>{model.priorityLabel}</Badge>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-semibold leading-5 text-foreground">
          {item.title}
        </p>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {model.currentStepLabel} · {model.targetLabel}
        </p>
        <time
          className="mt-1 block text-xs text-muted-foreground"
          dateTime={item.createdAt}
          title={model.absoluteTime}
        >
          {model.relativeTime}
        </time>
      </div>
      {item.href ? (
        <PartnerPendingButtonLink href={item.href} variant="secondary" size="sm" showSpinner>
          {model.ctaLabel}
        </PartnerPendingButtonLink>
      ) : null}
    </div>
  );
}

export default function PartnerNotificationCenter({
  data,
}: {
  data: PartnerNotificationCenterData;
}) {
  const { notify } = useToast();
  const [items, setItems] = useState(data.items);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "read-visible" | "delete-action" | null
  >(null);
  const [filters, setFilters] = useState<PartnerNotificationUiFilters>({
    category: "all",
    type: "all",
    purpose: "all",
    priority: "all",
    status: "all",
    readState: "all",
    companyId: "all",
    period: "all",
    searchQuery: "",
  });

  const uiItems = useMemo(
    () => items.map((item) => derivePartnerNotificationUiModel(item)),
    [items],
  );

  const summary = useMemo(() => summarizePartnerNotificationUiModels(uiItems), [uiItems]);

  const visibleItems = useMemo(
    () => filterPartnerNotificationUiModels(uiItems, filters),
    [filters, uiItems],
  );

  const attentionItems = useMemo(
    () =>
      uiItems
        .filter((model) => model.purpose === "action")
        .sort((left, right) => {
          const priorityRank: Record<PartnerNotificationPriority, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
          };
          return (
            priorityRank[left.priority] - priorityRank[right.priority] ||
            new Date(right.item.createdAt).getTime() - new Date(left.item.createdAt).getTime()
          );
        })
        .slice(0, 3),
    [uiItems],
  );

  const typeOptions = useMemo(() => {
    const map = new Map<PartnerNotificationUiType, string>();
    uiItems.forEach((model) => map.set(model.type, model.typeLabel));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [uiItems]);

  const statusOptions = useMemo(() => {
    const map = new Map<PartnerNotificationStatus, string>();
    uiItems.forEach((model) => map.set(model.item.status, model.statusLabel));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [uiItems]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    uiItems.forEach((model) => {
      map.set(model.item.companyId ?? "global", model.item.companyName || "계정 전역");
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [uiItems]);

  const activeFilterCount = [
    filters.category !== "all",
    filters.type !== "all",
    filters.purpose !== "all",
    filters.priority !== "all",
    filters.status !== "all",
    filters.readState !== "all",
    filters.companyId !== "all",
    filters.period !== "all",
    Boolean(filters.searchQuery.trim()),
  ].filter(Boolean).length;
  const isMutationPending = Boolean(pendingNotificationId || pendingBulkAction);
  const visibleUnreadNotificationIds = visibleItems
    .filter((model) => model.readState === "unread")
    .map((model) => model.item.notificationId)
    .filter((value): value is string => Boolean(value));
  const visibleActionNotificationIds = visibleItems
    .filter((model) => model.purpose === "action")
    .map((model) => model.item.notificationId)
    .filter((value): value is string => Boolean(value));

  function updateFilter<K extends keyof PartnerNotificationUiFilters>(
    key: K,
    value: PartnerNotificationUiFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function markNotificationAsRead(model: PartnerNotificationUiModel) {
    const notificationId = model.item.notificationId;
    if (!notificationId || pendingNotificationId || pendingBulkAction || model.readState !== "unread") {
      return;
    }

    const snapshot = items;
    const now = new Date().toISOString();
    setPendingNotificationId(notificationId);
    setItems((current) => updateNotificationReadState(current, [notificationId], now));

    try {
      await parsePartnerNotificationMutationResponse(
        await fetch(`/api/partner/notifications/${notificationId}`, {
          method: "PATCH",
        }),
      );
      notify("알림을 읽음 처리했습니다.");
    } catch (error) {
      setItems(snapshot);
      notify(error instanceof Error ? error.message : "읽음 처리에 실패했습니다.");
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function deleteNotification(model: PartnerNotificationUiModel) {
    const notificationId = model.item.notificationId;
    if (!notificationId || pendingNotificationId || pendingBulkAction) {
      return;
    }

    const snapshot = items;
    setPendingNotificationId(notificationId);
    setItems((current) => removeNotifications(current, [notificationId]));

    try {
      await parsePartnerNotificationMutationResponse(
        await fetch(`/api/partner/notifications/${notificationId}`, {
          method: "DELETE",
        }),
      );
      notify("처리 필요 알림을 삭제했습니다.");
    } catch (error) {
      setItems(snapshot);
      notify(error instanceof Error ? error.message : "알림 삭제에 실패했습니다.");
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function markVisibleNotificationsAsRead() {
    if (
      pendingNotificationId ||
      pendingBulkAction ||
      visibleUnreadNotificationIds.length === 0
    ) {
      return;
    }

    const snapshot = items;
    const now = new Date().toISOString();
    setPendingBulkAction("read-visible");
    setItems((current) => updateNotificationReadState(current, visibleUnreadNotificationIds, now));

    try {
      await parsePartnerNotificationMutationResponse(
        await fetch("/api/partner/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: visibleUnreadNotificationIds }),
        }),
      );
      notify("표시된 미확인 알림을 읽음 처리했습니다.");
    } catch (error) {
      setItems(snapshot);
      notify(error instanceof Error ? error.message : "전체 읽음 처리에 실패했습니다.");
    } finally {
      setPendingBulkAction(null);
    }
  }

  async function deleteVisibleActionNotifications() {
    if (
      pendingNotificationId ||
      pendingBulkAction ||
      visibleActionNotificationIds.length === 0
    ) {
      return;
    }

    if (!window.confirm("표시된 처리 필요 알림을 삭제할까요?")) {
      return;
    }

    const snapshot = items;
    setPendingBulkAction("delete-action");
    setItems((current) => removeNotifications(current, visibleActionNotificationIds));

    try {
      await parsePartnerNotificationMutationResponse(
        await fetch("/api/partner/notifications", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: visibleActionNotificationIds }),
        }),
      );
      notify("표시된 처리 필요 알림을 삭제했습니다.");
    } catch (error) {
      setItems(snapshot);
      notify(error instanceof Error ? error.message : "처리 필요 알림 삭제에 실패했습니다.");
    } finally {
      setPendingBulkAction(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      {data.warningMessage ? (
        <FormMessage variant="info">{data.warningMessage}</FormMessage>
      ) : null}
      <FormMessage variant="info">
        {PARTNER_NOTIFICATION_CENTER_SCOPE_LABEL}
      </FormMessage>

      {attentionItems.length > 0 ? (
        <Card tone="default" padding="md" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="ui-kicker">Action Notifications</p>
              <h2 className="text-xl font-semibold text-foreground">
                처리 필요 알림
              </h2>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                반려, 리뷰, 수정 요청처럼 사용자가 다음 조치를 해야 하는 알림만 모았습니다.
              </p>
            </div>
            <Badge variant="warning">{attentionItems.length}건</Badge>
          </div>
          <div className="grid gap-2">
            {attentionItems.map((model) => (
              <PriorityNotificationRow key={`priority:${model.item.id}`} model={model} />
            ))}
          </div>
        </Card>
      ) : null}

      <StatsRow
        minItemWidth="11rem"
        items={[
          {
            label: "미확인 알림",
            value: `${summary.unreadCount.toLocaleString("ko-KR")}건`,
            hint: "아직 확인하지 않았거나 강조된 알림",
          },
          {
            label: "처리 필요",
            value: `${summary.actionCount.toLocaleString("ko-KR")}건`,
            hint: "사용자 조치가 필요한 Action 알림",
          },
          {
            label: "승인 대기",
            value: `${summary.pendingCount.toLocaleString("ko-KR")}건`,
            hint: "관리자 검토 또는 입금 확인 단계",
          },
          {
            label: "반려됨",
            value: `${summary.rejectedCount.toLocaleString("ko-KR")}건`,
            hint: "다시 제출이 필요한 항목",
          },
          {
            label: "오늘 완료",
            value: `${summary.completedTodayCount.toLocaleString("ko-KR")}건`,
            hint: "오늘 완료 또는 안내된 상태",
          },
          {
            label: "High 이상",
            value: `${summary.highPriorityCount.toLocaleString("ko-KR")}건`,
            hint: "먼저 확인할 우선순위",
          },
        ]}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <Card tone="default" padding="md" className="space-y-4 xl:sticky xl:top-24">
          <div className="space-y-1">
            <p className="ui-kicker">검색과 필터</p>
            <p className="ui-body">
              목적, 유형, 상태, 협력사, 기간을 조합해 필요한 알림만 좁혀 봅니다.
            </p>
          </div>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">검색</span>
            <Input
              type="search"
              value={filters.searchQuery}
              onChange={(event) => updateFilter("searchQuery", event.target.value)}
              placeholder="브랜드, 상태, 알림 내용 검색"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SelectField
              label="목적"
              value={filters.purpose}
              onChange={(value) =>
                updateFilter("purpose", value as PartnerNotificationPurpose | "all")
              }
            >
              {purposeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="읽음 여부"
              value={filters.readState}
              onChange={(value) =>
                updateFilter("readState", value as PartnerNotificationReadState | "all")
              }
            >
              {readStateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="협력사"
              value={filters.companyId}
              onChange={(value) => updateFilter("companyId", value)}
            >
              <option value="all">전체 협력사</option>
              {companyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="유형"
              value={filters.type}
              onChange={(value) => updateFilter("type", value as PartnerNotificationUiType | "all")}
            >
              <option value="all">전체 유형</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="상태"
              value={filters.status}
              onChange={(value) =>
                updateFilter("status", value as PartnerNotificationStatus | "all")
              }
            >
              <option value="all">전체 상태</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="기간"
              value={filters.period}
              onChange={(value) =>
                updateFilter("period", value as PartnerNotificationUiFilters["period"])
              }
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="우선순위"
              value={filters.priority}
              onChange={(value) =>
                updateFilter("priority", value as PartnerNotificationPriority | "all")
              }
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="카테고리"
              value={filters.category}
              onChange={(value) =>
                updateFilter("category", value as PartnerNotificationCategory | "all")
              }
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
            <Badge variant="primary">{data.summary.companyCount}개 협력사</Badge>
            <Badge variant="neutral">{data.summary.serviceCount}개 브랜드</Badge>
            <Badge variant="neutral">
              필터 {activeFilterCount}개 · {visibleItems.length}건 표시
            </Badge>
          </div>

          <div className="grid gap-2 rounded-[1rem] border border-border bg-surface-inset p-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              loading={pendingBulkAction === "read-visible"}
              loadingText="읽음 처리 중"
              disabled={
                visibleUnreadNotificationIds.length === 0 || isMutationPending
              }
              onClick={() => {
                void markVisibleNotificationsAsRead();
              }}
            >
              표시된 미확인 읽음
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="w-full"
              loading={pendingBulkAction === "delete-action"}
              loadingText="삭제 중"
              disabled={
                visibleActionNotificationIds.length === 0 || isMutationPending
              }
              onClick={() => {
                void deleteVisibleActionNotifications();
              }}
            >
              처리 필요 알림 삭제
            </Button>
            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
              Information 알림은 읽음 처리만 제공하고, 삭제 같은 일괄 작업은
              Action 알림에만 적용합니다.
            </p>
          </div>

          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() =>
                setFilters({
                  category: "all",
                  type: "all",
                  purpose: "all",
                  priority: "all",
                  status: "all",
                  readState: "all",
                  companyId: "all",
                  period: "all",
                  searchQuery: "",
                })
              }
            >
              필터 초기화
            </Button>
          ) : null}
        </Card>

        {visibleItems.length === 0 ? (
          <EmptyState
            title="표시할 알림이 없습니다."
            description="검색어와 필터 조건을 조정해 다시 확인해 주세요."
            action={
              <PartnerPendingButtonLink href="/partner" variant="secondary">
                대시보드로 이동
              </PartnerPendingButtonLink>
            }
          />
        ) : (
          <div className="grid min-w-0 gap-3">
            {visibleItems.map((model) => (
              <NotificationCard
                key={model.item.id}
                model={model}
                pending={pendingNotificationId === model.item.notificationId}
                onMarkRead={markNotificationAsRead}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
