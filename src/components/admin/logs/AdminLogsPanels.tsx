import type { ReactNode } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import SectionHeading from '@/components/ui/SectionHeading';
import type { LogChartBucket, LogGroup } from '@/lib/log-insights';

export function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="h-full min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

export function InsightListCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
      <SectionHeading title={title} description={description} />
      <div className="mt-4 grid gap-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
            데이터가 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm"
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

export function SecurityStatusCard({
  success,
  failure,
  blocked,
}: {
  success: number;
  failure: number;
  blocked: number;
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
      <SectionHeading
        title="보안 상태 분포"
        description="조회 범위 안에서 인증과 보안 이벤트가 어떤 상태로 기록됐는지 보여줍니다."
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Success
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
            {success}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Failure
          </p>
          <p className="mt-2 text-2xl font-semibold text-danger">{failure}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4 text-center">
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

export function RangePresetButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: ReactNode;
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
          : 'border-border bg-surface-control text-foreground hover:border-strong',
        disabled ? 'cursor-not-allowed opacity-60' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

export function ActivityChart({
  buckets,
  loading,
  onSelectBucket,
}: {
  buckets: LogChartBucket[];
  loading: boolean;
  onSelectBucket: (bucket: LogChartBucket) => void;
}) {
  const width = Math.max(buckets.length * 84, 420);
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 56, left: 44 };
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maxValue = Math.max(...buckets.map((bucket) => bucket.total), 1);
  const stepX = buckets.length > 1 ? plotWidth / (buckets.length - 1) : 0;
  const chartPoints = buckets.map((bucket, index) => {
    const x = padding.left + stepX * index;
    return {
      bucket,
      x,
      productY: padding.top + plotHeight * (1 - bucket.product / maxValue),
      auditY: padding.top + plotHeight * (1 - bucket.audit / maxValue),
      securityY: padding.top + plotHeight * (1 - bucket.security / maxValue),
      totalY: padding.top + plotHeight * (1 - bucket.total / maxValue),
    };
  });
  const buildPath = (key: 'productY' | 'auditY' | 'securityY' | 'totalY') =>
    chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point[key]}`).join(' ');

  return (
    <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
      <SectionHeading
        title="조회 범위 활동량"
        description="점이나 구간 라벨을 누르면 해당 시간대로 바로 좁혀서 다시 조회합니다."
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
        <div className="min-w-max px-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto min-w-full"
            role="img"
            aria-label="조회 범위 활동량 선형 차트"
          >
            {Array.from({ length: 4 }, (_, index) => {
              const y = padding.top + plotHeight * (index / 3);
              const value = Math.round(maxValue * (1 - index / 3));
              return (
                <g key={`grid-${index}`} className="text-border/70">
                  <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={index === 3 ? 0.2 : 0.08}
                    strokeDasharray={index === 3 ? '0' : '3 7'}
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] font-medium"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <path d={buildPath('totalY')} fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/35" />
            <path d={buildPath('productY')} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-sky-500" />
            <path d={buildPath('auditY')} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-500" />
            <path d={buildPath('securityY')} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500" />

            {chartPoints.map((point) => (
              <g key={point.bucket.key}>
                <circle cx={point.x} cy={point.productY} r="4" className="fill-sky-500" />
                <circle cx={point.x} cy={point.auditY} r="4" className="fill-violet-500" />
                <circle cx={point.x} cy={point.securityY} r="4" className="fill-amber-500" />
                <circle cx={point.x} cy={point.totalY} r="5" className="fill-foreground/25" />
                <text
                  x={point.x}
                  y={height - 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-medium"
                >
                  {point.bucket.label}
                </text>
              </g>
            ))}
          </svg>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {buckets.map((bucket) => (
              <button
                key={bucket.key}
                type="button"
                disabled={loading}
                className="rounded-2xl border border-border bg-surface-inset px-3 py-3 text-left transition hover:border-strong disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onSelectBucket(bucket)}
                title={bucket.rangeLabel}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {bucket.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {bucket.total.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{bucket.rangeLabel}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ExportDialog({
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
      <Card className="relative z-10 w-full max-w-xl overflow-hidden bg-surface-overlay shadow-overlay">
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
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm text-foreground"
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
