import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import SectionHeading from '@/components/ui/SectionHeading';
import Select from '@/components/ui/Select';
import type { GroupFilter, NormalizedLog, SortFilter, StatusFilter } from './types';
import {
  formatDateTime,
  getGroupBadgeClass,
  getPropertyEntries,
  getStatusBadgeClass,
} from './utils';

export function AdminLogsExplorer({
  filteredLogs,
  filteredTotal,
  totalLogs,
  currentPage,
  totalPages,
  pageSize,
  pageInputValue,
  pageSizeOptions,
  pageStart,
  searchValue,
  groupFilter,
  nameFilter,
  actorFilter,
  statusFilter,
  sortFilter,
  availableNames,
  actorOptions,
  onSearchChange,
  onGroupFilterChange,
  onNameFilterChange,
  onActorFilterChange,
  onStatusFilterChange,
  onSortFilterChange,
  onPageInputChange,
  onPageSizeChange,
  onPageChange,
}: {
  filteredLogs: NormalizedLog[];
  filteredTotal: number;
  totalLogs: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageInputValue: string;
  pageSizeOptions: readonly number[];
  pageStart: number;
  searchValue: string;
  groupFilter: GroupFilter;
  nameFilter: string;
  actorFilter: 'all' | string;
  statusFilter: StatusFilter;
  sortFilter: SortFilter;
  availableNames: Array<{ value: string; label: string }>;
  actorOptions: string[];
  onSearchChange: (value: string) => void;
  onGroupFilterChange: (value: GroupFilter) => void;
  onNameFilterChange: (value: string) => void;
  onActorFilterChange: (value: 'all' | string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSortFilterChange: (value: SortFilter) => void;
  onPageInputChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onPageChange: (value: number) => void;
}) {
  const rangeLabel =
    filteredTotal === 0
      ? '0건'
      : `${pageStart + 1}-${Math.min(pageStart + filteredLogs.length, filteredTotal)} / ${filteredTotal}`;

  return (
    <section className="grid gap-5 rounded-panel border border-border/70 bg-surface-elevated px-5 py-5 shadow-flat sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="로그 탐색기"
          description="유저명, MM 아이디, IP, 경로, 속성까지 포함해 검색하고 정렬·필터링할 수 있습니다."
        />
        <Badge className="w-fit bg-surface text-muted-foreground">
          필터 결과 {filteredTotal.toLocaleString()}건 / 전체{' '}
          {totalLogs.toLocaleString()}건
        </Badge>
      </div>

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.55fr)] 2xl:items-start">
        <Card tone="muted" padding="md" className="grid gap-4 2xl:sticky 2xl:top-24">
          <div className="grid gap-1">
            <p className="ui-kicker">탐색 필터</p>
            <h3 className="text-lg font-semibold text-foreground">검색과 정렬</h3>
            <p className="text-sm text-muted-foreground">
              로그 그룹, 행위, 주체, 상태를 조합해 현재 결과를 좁힙니다.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-1">
            <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2 2xl:col-span-1">
              검색
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="유저명, @MM 아이디, IP, 경로, 대상, 속성으로 검색"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              로그 그룹
              <Select
                value={groupFilter}
                onChange={(event) => onGroupFilterChange(event.target.value as GroupFilter)}
              >
                <option value="all">전체</option>
                <option value="product">사용자</option>
                <option value="audit">관리자</option>
                <option value="security">보안</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              행위 종류
              <Select value={nameFilter} onChange={(event) => onNameFilterChange(event.target.value)}>
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
                onChange={(event) => onActorFilterChange(event.target.value)}
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
                onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}
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
                onChange={(event) => onSortFilterChange(event.target.value as SortFilter)}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="actor">유저명/MM 아이디순</option>
                <option value="ip">IP순</option>
              </Select>
            </label>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>현재 범위</span>
              <span className="font-semibold text-foreground">{rangeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>페이지</span>
              <span className="font-semibold text-foreground">
                {currentPage} / {totalPages}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface-muted/40 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>{rangeLabel}</p>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex items-center justify-between gap-2 whitespace-nowrap sm:justify-start">
                <span>페이지당</span>
                <Select
                  value={String(pageSize)}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}건
                    </option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap">
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(event) => onPageInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const parsed = Number.parseInt(pageInputValue, 10);
                      if (!Number.isNaN(parsed)) {
                        onPageChange(parsed);
                      }
                    }
                  }}
                  className="w-20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Number.parseInt(pageInputValue, 10);
                    if (!Number.isNaN(parsed)) {
                      onPageChange(parsed);
                    }
                  }}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground"
                >
                  이동
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
        {filteredLogs.length === 0 ? (
          <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
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
                className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised"
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
                        <span className="max-w-full break-all">입력 ID: {log.identifier}</span>
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
                        <span className="max-w-full break-all">대상 ID: {log.targetId}</span>
                      ) : null}
                    </div>
                  </div>

                  <Badge className="max-w-full break-all whitespace-normal bg-surface-muted text-muted-foreground">
                    {log.name}
                  </Badge>
                </div>

                {propertyEntries.length > 0 ? (
                  <div className="mt-4 grid gap-2 rounded-2xl border border-border/70 bg-surface-muted/50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      속성 요약
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {propertyEntries.map(([key, value]) => (
                        <Badge
                          key={key}
                          className="max-w-full break-all whitespace-normal bg-surface-muted text-foreground"
                        >
                          {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <details className="mt-4 rounded-2xl border border-border bg-surface-inset px-4 py-3">
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
        </div>
      </div>
    </section>
  );
}
