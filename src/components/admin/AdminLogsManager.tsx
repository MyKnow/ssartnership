'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import SectionHeading from '@/components/ui/SectionHeading';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import type {
  AdminLogsPageData,
  LogChartBucket,
  LogGroup,
  LogRangePreset,
} from '@/lib/log-insights';

type NormalizedLog = {
  id: string;
  group: LogGroup;
  name: string;
  label: string;
  status: string | null;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  actorMmUsername: string | null;
  identifier: string | null;
  ipAddress: string | null;
  path: string | null;
  referrer: string | null;
  targetType: string | null;
  targetId: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
  actorSearchLabel: string;
  searchText: string;
};

type SortFilter = 'newest' | 'oldest' | 'actor' | 'ip';
type GroupFilter = 'all' | LogGroup;
type StatusFilter = 'all' | 'success' | 'failure' | 'blocked';

const RANGE_PRESET_OPTIONS: Array<{ value: LogRangePreset; label: string }> = [
  { value: '1h', label: '1시간' },
  { value: '12h', label: '12시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '일주일' },
  { value: '30d', label: '한달' },
  { value: 'custom', label: '사용자 지정' },
];

const productLabels: Record<string, string> = {
  page_view: '페이지 조회',
  partner_detail_view: '파트너 상세 조회',
  partner_card_click: '파트너 카드 클릭',
  category_filter_change: '카테고리 필터 변경',
  search_execute: '검색 실행',
  sort_change: '정렬 변경',
  partner_map_click: '지도 클릭',
  reservation_click: '예약 클릭',
  inquiry_click: '문의 클릭',
  share_link_copy: '공유 링크 복사',
  push_settings_view: '알림 설정 조회',
  push_subscribe: '푸시 구독',
  push_unsubscribe_device: '현재 기기 알림 해제',
  push_unsubscribe_all: '모든 기기 알림 해제',
  push_preference_change: '푸시 설정 변경',
  suggest_submit: '제휴 제안 제출',
  pwa_install_click: 'PWA 설치 클릭',
  certification_view: '내 프로필 조회',
  certification_qr_open: '교육생 QR 열기',
  certification_qr_verify: '교육생 QR 검증',
};

const auditLabels: Record<string, string> = {
  login: '관리자 로그인',
  logout: '관리자 로그아웃',
  category_create: '카테고리 생성',
  category_update: '카테고리 수정',
  category_delete: '카테고리 삭제',
  partner_create: '업체 생성',
  partner_update: '업체 수정',
  partner_delete: '업체 삭제',
  partner_change_request_approve: '제휴 변경 요청 승인',
  partner_change_request_reject: '제휴 변경 요청 거절',
  member_update: '회원 수정',
  member_directory_sync: '회원 디렉토리 동기화',
  member_sync: '회원 정보 동기화',
  member_manual_add: '회원 수동 추가',
  member_delete: '회원 삭제',
  cycle_settings_update: '기수 기준 수정',
  cycle_settings_early_start: '기수 조기 시작',
  cycle_settings_restore: '기수 기준 복구',
  push_send: '푸시 발송',
  push_log_delete: '푸시 로그 삭제',
};

const securityLabels: Record<string, string> = {
  member_login: '회원 로그인',
  member_logout: '회원 로그아웃',
  member_signup_code_request: '회원가입 인증코드 요청',
  member_signup_complete: '회원가입 완료',
  member_policy_consent: '약관 동의',
  member_password_reset: '임시 비밀번호 발급',
  member_password_change: '비밀번호 변경',
  member_delete: '회원 탈퇴',
  admin_login: '관리자 로그인',
  admin_access: '관리자 접근 제어',
  partner_login: '제휴 포털 로그인',
  partner_logout: '제휴 포털 로그아웃',
  partner_password_reset: '제휴 포털 비밀번호 재설정',
  partner_password_change: '제휴 포털 비밀번호 변경',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function toIsoFromLocalValue(value: string) {
  return new Date(value).toISOString();
}

function getPropertyEntries(properties: Record<string, unknown> | null) {
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

function stringifyForSearch(properties: Record<string, unknown> | null) {
  try {
    return JSON.stringify(properties ?? {});
  } catch {
    return '';
  }
}

function getGroupBadgeClass(group: LogGroup) {
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

function getStatusBadgeClass(status: string | null) {
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

function getActorSearchLabel(log: {
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

function getLogLabel(group: LogGroup, name: string) {
  if (group === 'product') {
    return productLabels[name] ?? name;
  }
  if (group === 'audit') {
    return auditLabels[name] ?? name;
  }
  return securityLabels[name] ?? name;
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="h-full min-w-0 overflow-hidden bg-surface-elevated shadow-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

function InsightListCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-md">
      <SectionHeading title={title} description={description} />
      <div className="mt-4 grid gap-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
            데이터가 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 break-all text-left font-medium text-foreground">
                {item.label}
              </span>
              <span className="shrink-0 text-muted-foreground">{item.value}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function SecurityStatusCard({
  success,
  failure,
  blocked,
}: {
  success: number;
  failure: number;
  blocked: number;
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-md">
      <SectionHeading
        title="보안 상태 분포"
        description="조회 범위 안에서 인증과 보안 이벤트가 어떤 상태로 기록됐는지 보여줍니다."
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Success
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
            {success}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Failure
          </p>
          <p className="mt-2 text-2xl font-semibold text-danger">{failure}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Blocked
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-300">
            {blocked}
          </p>
        </div>
      </div>
    </Card>
  );
}

function RangePresetButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex min-h-12 min-w-0 items-center justify-center rounded-full border px-4 text-center text-sm font-semibold whitespace-normal break-keep transition',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-foreground hover:border-strong',
        disabled ? 'cursor-not-allowed opacity-60' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

function ActivityChart({
  buckets,
  loading,
  onSelectBucket,
}: {
  buckets: LogChartBucket[];
  loading: boolean;
  onSelectBucket: (bucket: LogChartBucket) => void;
}) {
  const maxTotal = Math.max(...buckets.map((bucket) => bucket.total), 1);

  return (
    <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-md">
      <SectionHeading
        title="조회 범위 활동량"
        description="막대를 누르면 해당 구간으로 바로 좁혀서 다시 조회합니다."
      />

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
          사용자 이벤트
        </Badge>
        <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
          관리자 감사
        </Badge>
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
          인증·보안
        </Badge>
      </div>

      <div className="-mx-1 mt-5 overflow-x-auto pb-2">
        <div className="flex min-w-max items-end gap-2 px-1 sm:gap-3">
          {buckets.map((bucket) => {
            const totalHeight =
              bucket.total === 0 ? 6 : Math.max(16, (bucket.total / maxTotal) * 160);
            const productHeight =
              bucket.total === 0 ? 0 : (bucket.product / bucket.total) * totalHeight;
            const auditHeight =
              bucket.total === 0 ? 0 : (bucket.audit / bucket.total) * totalHeight;
            const securityHeight =
              bucket.total === 0 ? 0 : (bucket.security / bucket.total) * totalHeight;

            return (
              <button
                key={bucket.key}
                type="button"
                disabled={loading}
                className="group flex w-14 shrink-0 flex-col items-center gap-1.5 text-center disabled:cursor-not-allowed disabled:opacity-60 sm:w-16 md:w-[4.5rem]"
                onClick={() => onSelectBucket(bucket)}
                title={bucket.rangeLabel}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {bucket.total}
                </span>
                <div className="flex h-40 w-full items-end rounded-[1.4rem] border border-border bg-surface px-2 py-2 transition group-hover:border-strong sm:h-44 md:h-52 sm:px-2.5 sm:py-2.5 md:px-3 md:py-3">
                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-2xl bg-surface-muted"
                    style={{ height: `${totalHeight}px` }}
                  >
                    {securityHeight > 0 ? (
                      <div
                        className="w-full bg-amber-500/75"
                        style={{ height: `${securityHeight}px` }}
                      />
                    ) : null}
                    {auditHeight > 0 ? (
                      <div
                        className="w-full bg-violet-500/75"
                        style={{ height: `${auditHeight}px` }}
                      />
                    ) : null}
                    {productHeight > 0 ? (
                      <div
                        className="w-full bg-sky-500/75"
                        style={{ height: `${productHeight}px` }}
                      />
                    ) : null}
                  </div>
                </div>
                <span className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  {bucket.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function ExportDialog({
  open,
  exportScope,
  exportGroups,
  exportCustomStart,
  exportCustomEnd,
  loading,
  onClose,
  onChangeScope,
  onToggleGroup,
  onChangeCustomStart,
  onChangeCustomEnd,
  onSubmit,
}: {
  open: boolean;
  exportScope: 'current' | 'custom';
  exportGroups: Record<LogGroup, boolean>;
  exportCustomStart: string;
  exportCustomEnd: string;
  loading: boolean;
  onClose: () => void;
  onChangeScope: (value: 'current' | 'custom') => void;
  onToggleGroup: (group: LogGroup) => void;
  onChangeCustomStart: (value: string) => void;
  onChangeCustomEnd: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        aria-label="CSV 다운로드 닫기"
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-xl overflow-hidden bg-surface">
        <SectionHeading
          title="CSV 다운로드"
          description="현재 조회 범위 또는 별도 사용자 지정 범위를 골라 로그를 CSV로 내보냅니다."
        />

        <div className="mt-6 grid gap-5">
          <div className="grid gap-3">
            <p className="text-sm font-medium text-foreground">내보낼 범위</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <RangePresetButton
                active={exportScope === 'current'}
                onClick={() => onChangeScope('current')}
                disabled={loading}
              >
                기본값: 현재 조회 범위
              </RangePresetButton>
              <RangePresetButton
                active={exportScope === 'custom'}
                onClick={() => onChangeScope('custom')}
                disabled={loading}
              >
                커스텀: 사용자 지정 범위
              </RangePresetButton>
            </div>
          </div>

          {exportScope === 'custom' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                시작 시각
                <Input
                  type="datetime-local"
                  value={exportCustomStart}
                  onChange={(event) => onChangeCustomStart(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                종료 시각
                <Input
                  type="datetime-local"
                  value={exportCustomEnd}
                  onChange={(event) => onChangeCustomEnd(event.target.value)}
                />
              </label>
            </div>
          ) : null}

            <div className="grid gap-3">
              <p className="text-sm font-medium text-foreground">내보낼 로그 종류</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['product', '사용자 이벤트'],
                ['audit', '관리자 감사'],
                ['security', '인증·보안'],
              ] as Array<[LogGroup, string]>).map(([group, label]) => (
                <label
                  key={group}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={exportGroups[group]}
                    onChange={() => onToggleGroup(group)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    disabled={loading}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={onSubmit} loading={loading} loadingText="다운로드 중">
            CSV 다운로드
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function AdminLogsManager({
  initialData,
}: {
  initialData: AdminLogsPageData;
}) {
  const { notify } = useToast();
  const [data, setData] = useState(initialData);
  const [activePreset, setActivePreset] = useState<LogRangePreset>(
    initialData.range.preset,
  );
  const [customStartInput, setCustomStartInput] = useState(
    toDateTimeLocalValue(initialData.range.start),
  );
  const [customEndInput, setCustomEndInput] = useState(
    toDateTimeLocalValue(initialData.range.end),
  );
  const [searchValue, setSearchValue] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [nameFilter, setNameFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'custom'>('current');
  const [exportCustomStart, setExportCustomStart] = useState(
    toDateTimeLocalValue(initialData.range.start),
  );
  const [exportCustomEnd, setExportCustomEnd] = useState(
    toDateTimeLocalValue(initialData.range.end),
  );
  const [exportGroups, setExportGroups] = useState<Record<LogGroup, boolean>>({
    product: true,
    audit: true,
    security: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const unifiedLogs = useMemo<NormalizedLog[]>(() => {
    const normalizedProduct = data.productLogs.map((log) => {
      const actorSearchLabel = getActorSearchLabel({
        actorType: log.actor_type,
        actorMmUsername: log.actor_mm_username,
        actorName: log.actor_name,
        actorId: log.actor_id,
        identifier: null,
      });

      return {
        id: log.id,
        group: 'product' as const,
        name: String(log.event_name),
        label: getLogLabel('product', String(log.event_name)),
        status: null,
        actorType: log.actor_type ?? null,
        actorId: log.actor_id ?? null,
        actorName: log.actor_name ?? null,
        actorMmUsername: log.actor_mm_username ?? null,
        identifier: null,
        ipAddress: log.ip_address ?? null,
        path: log.path ?? null,
        referrer: log.referrer ?? null,
        targetType: log.target_type ?? null,
        targetId: log.target_id ?? null,
        properties: log.properties ?? null,
        createdAt: log.created_at,
        actorSearchLabel,
        searchText: [
          log.event_name,
          actorSearchLabel,
          log.actor_name,
          log.actor_mm_username,
          log.actor_type,
          log.actor_id,
          log.ip_address,
          log.path,
          log.referrer,
          log.target_type,
          log.target_id,
          stringifyForSearch(log.properties ?? null),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    });

    const normalizedAudit = data.auditLogs.map((log) => {
      const actorSearchLabel = log.actor_id ?? 'admin';
      return {
        id: log.id,
        group: 'audit' as const,
        name: String(log.action),
        label: getLogLabel('audit', String(log.action)),
        status: null,
        actorType: 'admin',
        actorId: log.actor_id ?? null,
        actorName: null,
        actorMmUsername: null,
        identifier: null,
        ipAddress: log.ip_address ?? null,
        path: log.path ?? null,
        referrer: null,
        targetType: log.target_type ?? null,
        targetId: log.target_id ?? null,
        properties: log.properties ?? null,
        createdAt: log.created_at,
        actorSearchLabel,
        searchText: [
          log.action,
          log.actor_id,
          log.ip_address,
          log.path,
          log.target_type,
          log.target_id,
          stringifyForSearch(log.properties ?? null),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    });

    const normalizedSecurity = data.securityLogs.map((log) => {
      const actorSearchLabel = getActorSearchLabel({
        actorType: log.actor_type,
        actorMmUsername: log.actor_mm_username,
        actorName: log.actor_name,
        actorId: log.actor_id,
        identifier: log.identifier,
      });

      return {
        id: log.id,
        group: 'security' as const,
        name: String(log.event_name),
        label: getLogLabel('security', String(log.event_name)),
        status: log.status ?? null,
        actorType: log.actor_type ?? null,
        actorId: log.actor_id ?? null,
        actorName: log.actor_name ?? null,
        actorMmUsername: log.actor_mm_username ?? null,
        identifier: log.identifier ?? null,
        ipAddress: log.ip_address ?? null,
        path: log.path ?? null,
        referrer: null,
        targetType: null,
        targetId: null,
        properties: log.properties ?? null,
        createdAt: log.created_at,
        actorSearchLabel,
        searchText: [
          log.event_name,
          log.status,
          actorSearchLabel,
          log.actor_name,
          log.actor_mm_username,
          log.actor_type,
          log.actor_id,
          log.identifier,
          log.ip_address,
          log.path,
          stringifyForSearch(log.properties ?? null),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    });

    return [...normalizedProduct, ...normalizedAudit, ...normalizedSecurity];
  }, [data]);

  const availableNames = useMemo(() => {
    const names = unifiedLogs
      .filter((log) => groupFilter === 'all' || log.group === groupFilter)
      .map((log) => ({ value: log.name, label: log.label }));
    return Array.from(new Map(names.map((item) => [item.value, item])).values()).sort(
      (a, b) => a.label.localeCompare(b.label, 'ko-KR'),
    );
  }, [groupFilter, unifiedLogs]);

  const actorOptions = useMemo(() => {
    return Array.from(
      new Set(
        unifiedLogs
          .map((log) => log.actorType)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [unifiedLogs]);

  const filteredLogs = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const next = unifiedLogs.filter((log) => {
      if (groupFilter !== 'all' && log.group !== groupFilter) {
        return false;
      }
      if (actorFilter !== 'all' && log.actorType !== actorFilter) {
        return false;
      }
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }
      if (nameFilter !== 'all' && log.name !== nameFilter) {
        return false;
      }
      if (query && !log.searchText.includes(query)) {
        return false;
      }
      return true;
    });

    next.sort((a, b) => {
      if (sortFilter === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortFilter === 'actor') {
        return a.actorSearchLabel.localeCompare(b.actorSearchLabel, 'ko-KR');
      }
      if (sortFilter === 'ip') {
        return (a.ipAddress ?? '').localeCompare(b.ipAddress ?? '', 'ko-KR');
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return next;
  }, [
    actorFilter,
    groupFilter,
    nameFilter,
    searchValue,
    sortFilter,
    statusFilter,
    unifiedLogs,
  ]);

  const totalLogs = data.counts.product + data.counts.audit + data.counts.security;

  const topProductEvents = useMemo(() => {
    const counts = new Map<string, number>();
    data.productLogs.forEach((log) => {
      const key = String(log.event_name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value]) => ({ label: getLogLabel('product', key), value: `${value}건` }));
  }, [data.productLogs]);

  const topAuditActions = useMemo(() => {
    const counts = new Map<string, number>();
    data.auditLogs.forEach((log) => {
      const key = String(log.action);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value]) => ({ label: getLogLabel('audit', key), value: `${value}건` }));
  }, [data.auditLogs]);

  const topActors = useMemo(() => {
    const counts = new Map<string, number>();
    unifiedLogs.forEach((log) => {
      const key = log.actorSearchLabel;
      if (!key || key === '비로그인 사용자') {
        return;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value]) => ({ label: key, value: `${value}건` }));
  }, [unifiedLogs]);

  const topIps = useMemo(() => {
    const counts = new Map<string, number>();
    unifiedLogs.forEach((log) => {
      if (!log.ipAddress) {
        return;
      }
      counts.set(log.ipAddress, (counts.get(log.ipAddress) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value]) => ({ label: key, value: `${value}건` }));
  }, [unifiedLogs]);

  const topPaths = useMemo(() => {
    const counts = new Map<string, number>();
    unifiedLogs.forEach((log) => {
      if (!log.path) {
        return;
      }
      counts.set(log.path, (counts.get(log.path) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value]) => ({ label: key, value: `${value}건` }));
  }, [unifiedLogs]);

  const securityStatusCounts = useMemo(() => {
    return {
      success: data.securityLogs.filter((log) => log.status === 'success').length,
      failure: data.securityLogs.filter((log) => log.status === 'failure').length,
      blocked: data.securityLogs.filter((log) => log.status === 'blocked').length,
    };
  }, [data.securityLogs]);

  async function fetchLogs(params: {
    preset: LogRangePreset;
    start?: string;
    end?: string;
  }) {
    setIsLoading(true);

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('preset', params.preset);
      if (params.start) {
        searchParams.set('start', params.start);
      }
      if (params.end) {
        searchParams.set('end', params.end);
      }

      const response = await fetch(`/api/admin/logs?${searchParams.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? '로그 조회에 실패했습니다.');
      }

      const nextData = (await response.json()) as AdminLogsPageData;
      setData(nextData);
      setActivePreset(nextData.range.preset);
      setCustomStartInput(toDateTimeLocalValue(nextData.range.start));
      setCustomEndInput(toDateTimeLocalValue(nextData.range.end));
    } catch (error) {
      notify(error instanceof Error ? error.message : '로그 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function handlePresetSelect(preset: LogRangePreset) {
    setActivePreset(preset);
    if (preset === 'custom') {
      return;
    }
    void fetchLogs({ preset });
  }

  function handleApplyCustomRange() {
    if (!customStartInput || !customEndInput) {
      notify('시작 시각과 종료 시각을 모두 입력해 주세요.');
      return;
    }

    const start = new Date(customStartInput);
    const end = new Date(customEndInput);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      notify('유효한 날짜 범위를 입력해 주세요.');
      return;
    }

    void fetchLogs({
      preset: 'custom',
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  function handleBucketSelect(bucket: LogChartBucket) {
    setActivePreset('custom');
    setCustomStartInput(toDateTimeLocalValue(bucket.start));
    setCustomEndInput(toDateTimeLocalValue(bucket.end));
    void fetchLogs({
      preset: 'custom',
      start: bucket.start,
      end: bucket.end,
    });
  }

  function handleOpenExport() {
    setExportScope('current');
    setExportCustomStart(toDateTimeLocalValue(data.range.start));
    setExportCustomEnd(toDateTimeLocalValue(data.range.end));
    setExportOpen(true);
  }

  async function handleExport() {
    const selectedGroups = (Object.entries(exportGroups) as Array<[LogGroup, boolean]>)
      .filter(([, checked]) => checked)
      .map(([group]) => group);

    if (!selectedGroups.length) {
      notify('내보낼 로그 종류를 하나 이상 선택해 주세요.');
      return;
    }

    let start = data.range.start;
    let end = data.range.end;

    if (exportScope === 'custom') {
      if (!exportCustomStart || !exportCustomEnd) {
        notify('내보낼 사용자 지정 범위를 입력해 주세요.');
        return;
      }
      try {
        start = toIsoFromLocalValue(exportCustomStart);
        end = toIsoFromLocalValue(exportCustomEnd);
      } catch {
        notify('유효한 사용자 지정 범위를 입력해 주세요.');
        return;
      }
    }

    setIsExporting(true);

    try {
      const searchParams = new URLSearchParams({
        preset: 'custom',
        start,
        end,
        groups: selectedGroups.join(','),
      });

      const response = await fetch(
        `/api/admin/logs/export?${searchParams.toString()}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? 'CSV 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `admin-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setExportOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'CSV 다운로드에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <div className="grid min-w-0 gap-8 overflow-x-hidden">
        <section className="grid gap-4 rounded-3xl border border-border bg-surface-muted/50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="로그 집계 뷰"
              description="조회 범위를 바꾸면 카드, 대시보드, 원본 로그가 모두 같은 범위 기준으로 다시 집계됩니다."
            />
            <Button variant="ghost" onClick={handleOpenExport} className="self-end sm:self-auto">
              CSV 다운로드
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {RANGE_PRESET_OPTIONS.map((option) => (
              <RangePresetButton
                key={option.value}
                active={activePreset === option.value}
                onClick={() => handlePresetSelect(option.value)}
                disabled={isLoading}
              >
                {option.label}
              </RangePresetButton>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <p className="text-sm font-semibold text-foreground">현재 조회 범위</p>
                <p className="break-all text-sm text-muted-foreground">{data.range.label}</p>
              </div>
              <Badge className="bg-surface-muted text-muted-foreground">
                {data.range.bucketLabel}
              </Badge>
            </div>
          </div>

          {activePreset === 'custom' ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                시작 시각
                <Input
                  type="datetime-local"
                  value={customStartInput}
                  onChange={(event) => setCustomStartInput(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                종료 시각
                <Input
                  type="datetime-local"
                  value={customEndInput}
                  onChange={(event) => setCustomEndInput(event.target.value)}
                />
              </label>
              <div className="flex items-end justify-end">
                <Button
                  onClick={handleApplyCustomRange}
                  loading={isLoading}
                  loadingText="조회 중"
                  className="w-full lg:w-auto"
                >
                  범위 적용
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="전체 로그"
            value={`${totalLogs.toLocaleString()}건`}
            description="현재 조회 범위 안에서 적재된 전체 로그 수입니다."
          />
          <MetricCard
            title="사용자 이벤트"
            value={`${data.counts.product.toLocaleString()}건`}
            description="페이지 조회, 클릭, 검색, 푸시 설정 등 제품 로그입니다."
          />
          <MetricCard
            title="관리자 감사"
            value={`${data.counts.audit.toLocaleString()}건`}
            description="관리자 CRUD와 푸시 발송/삭제 같은 조작 이력입니다."
          />
          <MetricCard
            title="인증·보안"
            value={`${data.counts.security.toLocaleString()}건`}
            description="로그인, 회원가입 인증, 비밀번호/탈퇴 관련 로그입니다."
          />
        </section>

        <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
          <div className="min-w-0">
            <ActivityChart
              buckets={data.chartBuckets}
              loading={isLoading}
              onSelectBucket={handleBucketSelect}
            />
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <SecurityStatusCard
              success={securityStatusCounts.success}
              failure={securityStatusCounts.failure}
              blocked={securityStatusCounts.blocked}
            />
            <InsightListCard
              title="상위 사용자 이벤트"
              description="조회 범위 안에서 가장 많이 발생한 사용자 이벤트입니다."
              items={topProductEvents}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <InsightListCard
            title="상위 관리자 액션"
            description="조회 범위 안에서 많이 발생한 관리자 작업입니다."
            items={topAuditActions}
          />
          <InsightListCard
            title="상위 사용자/MM ID"
            description="로그인된 사용자 기준으로 가장 많이 행위를 남긴 계정입니다."
            items={topActors}
          />
          <InsightListCard
            title="상위 IP"
            description="조회 범위 안에서 가장 많은 로그를 남긴 IP 주소입니다."
            items={topIps}
          />
          <InsightListCard
            title="상위 경로"
            description="가장 자주 기록된 페이지 경로입니다."
            items={topPaths}
          />
        </section>

        <section className="grid gap-4 rounded-3xl border border-border bg-surface-muted/50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="로그 탐색기"
              description="유저명, MM 아이디, IP, 경로, 속성까지 포함해 검색하고 정렬·필터링할 수 있습니다."
            />
            <Badge className="w-fit bg-surface text-muted-foreground">
              필터 결과 {filteredLogs.length.toLocaleString()}건 / 전체{' '}
              {totalLogs.toLocaleString()}건
            </Badge>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,0.8fr))]">
            <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2 xl:col-span-1">
              검색
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="유저명, @MM 아이디, IP, 경로, 대상, 속성으로 검색"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              로그 그룹
              <Select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value as GroupFilter)}
              >
                <option value="all">전체</option>
                <option value="product">사용자</option>
                <option value="audit">관리자</option>
                <option value="security">보안</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              행위 종류
              <Select value={nameFilter} onChange={(event) => setNameFilter(event.target.value)}>
                <option value="all">전체</option>
                {availableNames.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              주체 타입
              <Select
                value={actorFilter}
                onChange={(event) => setActorFilter(event.target.value)}
              >
                <option value="all">전체</option>
                {actorOptions.map((actorType) => (
                  <option key={actorType} value={actorType}>
                    {actorType}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              보안 상태
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">전체</option>
                <option value="success">success</option>
                <option value="failure">failure</option>
                <option value="blocked">blocked</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              정렬
              <Select
                value={sortFilter}
                onChange={(event) => setSortFilter(event.target.value as SortFilter)}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="actor">유저명/MM 아이디순</option>
                <option value="ip">IP순</option>
              </Select>
            </label>
          </div>

          <div className="grid gap-4">
            {filteredLogs.length === 0 ? (
              <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-md">
                <EmptyState
                  title="조건에 맞는 로그가 없습니다."
                  description="검색어나 범위, 필터 조건을 조정해 다시 확인해 주세요."
                />
              </Card>
            ) : (
              filteredLogs.map((log) => {
                const propertyEntries = getPropertyEntries(log.properties).slice(0, 8);
                return (
                  <Card
                    key={`${log.group}-${log.id}`}
                    className="min-w-0 overflow-hidden bg-surface-elevated shadow-md"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={getGroupBadgeClass(log.group)}>
                            {log.group === 'product'
                              ? '사용자'
                              : log.group === 'audit'
                                ? '관리자'
                                : '보안'}
                          </Badge>
                          {log.status ? (
                            <Badge className={getStatusBadgeClass(log.status)}>
                              {log.status}
                            </Badge>
                          ) : null}
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>

                        <h3 className="mt-3 break-words text-lg font-semibold text-foreground">
                          {log.label}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {log.actorType ? (
                            <span className="max-w-full break-all">주체: {log.actorType}</span>
                          ) : null}
                          {log.actorMmUsername ? (
                            <span className="max-w-full break-all">
                              MM 아이디: @{log.actorMmUsername}
                            </span>
                          ) : null}
                          {log.actorName ? (
                            <span className="max-w-full break-all">이름: {log.actorName}</span>
                          ) : null}
                          {log.identifier && !log.actorMmUsername ? (
                            <span className="max-w-full break-all">
                              입력 ID: {log.identifier}
                            </span>
                          ) : null}
                          {log.actorId ? (
                            <span className="max-w-full break-all">내부 ID: {log.actorId}</span>
                          ) : null}
                          {log.ipAddress ? (
                            <span className="max-w-full break-all">IP: {log.ipAddress}</span>
                          ) : null}
                          {log.path ? (
                            <span className="max-w-full break-all">경로: {log.path}</span>
                          ) : null}
                          {log.targetType ? (
                            <span className="max-w-full break-all">대상: {log.targetType}</span>
                          ) : null}
                          {log.targetId ? (
                            <span className="max-w-full break-all">
                              대상 ID: {log.targetId}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <Badge className="max-w-full break-all whitespace-normal bg-surface-muted text-muted-foreground">
                        {log.name}
                      </Badge>
                    </div>

                    {propertyEntries.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {propertyEntries.map(([key, value]) => (
                          <Badge
                            key={key}
                            className="max-w-full break-all whitespace-normal bg-surface-muted text-foreground"
                          >
                            {key}:{' '}
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <details className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                        상세 보기
                      </summary>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-3">
                            <span>그룹</span>
                            <span className="font-medium text-foreground">{log.group}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>이벤트</span>
                            <span className="max-w-full break-all font-medium text-foreground">
                              {log.name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>주체</span>
                            <span className="max-w-full break-all font-medium text-foreground">
                              {log.actorSearchLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>상태</span>
                            <span className="font-medium text-foreground">
                              {log.status ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>경로</span>
                            <span className="max-w-full break-all font-medium text-foreground">
                              {log.path ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>대상</span>
                            <span className="max-w-full break-all font-medium text-foreground">
                              {log.targetType ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>대상 ID</span>
                            <span className="max-w-full break-all font-medium text-foreground">
                              {log.targetId ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>생성 시각</span>
                            <span className="font-medium text-foreground">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface-muted p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            properties
                          </p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
                            {JSON.stringify(log.properties ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </Card>
                );
              })
            )}
          </div>
        </section>
      </div>

      <ExportDialog
        open={exportOpen}
        exportScope={exportScope}
        exportGroups={exportGroups}
        exportCustomStart={exportCustomStart}
        exportCustomEnd={exportCustomEnd}
        loading={isExporting}
        onClose={() => {
          if (!isExporting) {
            setExportOpen(false);
          }
        }}
        onChangeScope={setExportScope}
        onToggleGroup={(group) =>
          setExportGroups((prev) => ({
            ...prev,
            [group]: !prev[group],
          }))
        }
        onChangeCustomStart={setExportCustomStart}
        onChangeCustomEnd={setExportCustomEnd}
        onSubmit={handleExport}
      />
    </>
  );
}
