import { PRODUCT_EVENT_LABELS, ADMIN_AUDIT_LABELS, AUTH_SECURITY_LABELS } from "@/lib/event-labels";
import type { LogGroup, LogRangePreset } from '@/lib/log-insights';
import {
  formatKoreanDateTime,
  formatKoreanDateTimeLocalValue,
  toIsoFromKoreanDateTimeLocalValue,
} from "@/lib/datetime";

export const RANGE_PRESET_OPTIONS: Array<{ value: LogRangePreset; label: string }> = [
  { value: '1h', label: '1시간' },
  { value: '12h', label: '12시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '일주일' },
  { value: '30d', label: '한달' },
  { value: 'custom', label: '사용자 지정' },
];

const productLabels: Readonly<Record<string, string>> = PRODUCT_EVENT_LABELS;

const auditLabels: Readonly<Record<string, string>> = ADMIN_AUDIT_LABELS;

const securityLabels: Readonly<Record<string, string>> = AUTH_SECURITY_LABELS;

export function formatDateTime(value: string) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTimeLocalValue(value: string) {
  return formatKoreanDateTimeLocalValue(value);
}

export function toIsoFromLocalValue(value: string) {
  return toIsoFromKoreanDateTimeLocalValue(value);
}

export function getPropertyEntries(properties: Record<string, unknown> | null) {
  return Object.entries(properties ?? {}).filter(([, value]) => {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  });
}

export function stringifyForSearch(properties: Record<string, unknown> | null) {
  try {
    return JSON.stringify(properties ?? {});
  } catch {
    return '';
  }
}

export function getGroupBadgeClass(group: LogGroup) {
  switch (group) {
    case 'product':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'audit':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
    case 'security':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    default:
      return 'bg-surface-muted text-muted-foreground';
  }
}

export function getStatusBadgeClass(status: string | null) {
  if (status === 'success') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'failure') {
    return 'bg-danger/15 text-danger';
  }
  if (status === 'blocked') {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  }
  return 'bg-surface-muted text-muted-foreground';
}

export function getActorSearchLabel(log: {
  actorType: string | null;
  actorMmUsername: string | null;
  actorName: string | null;
  actorId: string | null;
  identifier: string | null;
}) {
  if (log.actorMmUsername) {
    return `@${log.actorMmUsername}`;
  }
  if (log.actorName) {
    return log.actorName;
  }
  if (log.identifier) {
    return log.identifier;
  }
  if (log.actorId) {
    return log.actorId;
  }
  if (log.actorType === 'guest') {
    return '비로그인 사용자';
  }
  return '알 수 없음';
}

export function getLogLabel(group: LogGroup, name: string) {
  if (group === 'product') {
    return productLabels[name] ?? name;
  }
  if (group === 'audit') {
    return auditLabels[name] ?? name;
  }
  return securityLabels[name] ?? name;
}
