'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FormMessage from '@/components/ui/FormMessage';
import Input from '@/components/ui/Input';
import SectionHeading from '@/components/ui/SectionHeading';
import {
  ActivityChart,
  ExportDialog,
  InsightListCard,
  MetricCard,
  RangePresetButton,
  SecurityStatusCard,
} from '@/components/admin/logs/AdminLogsPanels';
import { AdminLogsExplorer } from '@/components/admin/logs/AdminLogsExplorer';
import { RANGE_PRESET_OPTIONS } from '@/components/admin/logs/utils';
import type { AdminLogsPageData } from '@/lib/log-insights';
import { useAdminLogsManager } from '@/components/admin/logs-manager/useAdminLogsManager';

export default function AdminLogsManagerContent({
  initialData,
}: {
  initialData: AdminLogsPageData;
}) {
  const logs = useAdminLogsManager(initialData);

  return (
    <>
      <div className="grid min-w-0 gap-6 overflow-x-hidden">
        <section className="grid gap-4 rounded-panel border border-border/70 bg-surface-elevated px-5 py-5 shadow-flat sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="로그 집계 뷰"
              description="조회 범위를 바꾸면 카드, 대시보드, 원본 로그가 모두 같은 범위 기준으로 다시 집계됩니다."
            />
            <Button variant="ghost" onClick={logs.handleOpenExport} className="self-end sm:self-auto">
              CSV 다운로드
            </Button>
          </div>

          {logs.errorMessage ? <FormMessage variant="error">{logs.errorMessage}</FormMessage> : null}

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {RANGE_PRESET_OPTIONS.map((option) => (
              <RangePresetButton
                key={option.value}
                active={logs.activePreset === option.value}
                onClick={() => logs.handlePresetSelect(option.value)}
                disabled={logs.isLoading}
              >
                {option.label}
              </RangePresetButton>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <p className="text-sm font-semibold text-foreground">현재 조회 범위</p>
                <p className="break-all text-sm text-muted-foreground">{logs.data.range.label}</p>
              </div>
              <Badge className="bg-surface-muted text-muted-foreground">
                {logs.data.range.bucketLabel}
              </Badge>
            </div>
          </div>

          {logs.data.truncated.any && logs.data.truncated.limitPerGroup !== null ? (
            <FormMessage variant="error">
              조회 범위의 로그가 많아 그룹별 최근 {logs.data.truncated.limitPerGroup.toLocaleString()}건만 불러왔습니다. 더 넓은 원본은 CSV 다운로드로 확인하세요.
            </FormMessage>
          ) : null}

          {logs.activePreset === 'custom' ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                시작 시각
                <Input
                  type="datetime-local"
                  value={logs.customStartInput}
                  onChange={(event) => logs.setCustomStartInput(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                종료 시각
                <Input
                  type="datetime-local"
                  value={logs.customEndInput}
                  onChange={(event) => logs.setCustomEndInput(event.target.value)}
                />
              </label>
              <div className="flex items-end justify-end">
                <Button
                  onClick={logs.handleApplyCustomRange}
                  loading={logs.isLoading}
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
            value={`${logs.totalLogs.toLocaleString()}건`}
            description="현재 조회 범위 안에서 적재된 전체 로그 수입니다."
          />
          <MetricCard
            title="사용자 이벤트"
            value={`${logs.data.counts.product.toLocaleString()}건`}
            description="페이지 조회, 클릭, 검색, 푸시 설정 등 제품 로그입니다."
          />
          <MetricCard
            title="관리자 감사"
            value={`${logs.data.counts.audit.toLocaleString()}건`}
            description="관리자 CRUD와 푸시 발송/삭제 같은 조작 이력입니다."
          />
          <MetricCard
            title="인증·보안"
            value={`${logs.data.counts.security.toLocaleString()}건`}
            description="로그인, 회원가입 인증, 비밀번호/탈퇴 관련 로그입니다."
          />
        </section>

        <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.92fr)]">
          <div className="min-w-0">
            <ActivityChart
              buckets={logs.data.chartBuckets}
              loading={logs.isLoading}
              onSelectBucket={logs.handleBucketSelect}
            />
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <SecurityStatusCard
              success={logs.securityStatusCounts.success}
              failure={logs.securityStatusCounts.failure}
              blocked={logs.securityStatusCounts.blocked}
            />
            <InsightListCard
              title="상위 사용자 이벤트"
              description="조회 범위 안에서 가장 많이 발생한 사용자 이벤트입니다."
              items={logs.topProductEvents}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <InsightListCard
            title="상위 관리자 액션"
            description="조회 범위 안에서 많이 발생한 관리자 작업입니다."
            items={logs.topAuditActions}
          />
          <InsightListCard
            title="상위 사용자/MM ID"
            description="로그인된 사용자 기준으로 가장 많이 행위를 남긴 계정입니다."
            items={logs.topActors}
          />
          <InsightListCard
            title="상위 IP"
            description="조회 범위 안에서 가장 많은 로그를 남긴 IP 주소입니다."
            items={logs.topIps}
          />
          <InsightListCard
            title="상위 경로"
            description="가장 자주 기록된 페이지 경로입니다."
            items={logs.topPaths}
          />
        </section>

        <AdminLogsExplorer
          filteredLogs={logs.visibleLogs}
          filteredTotal={logs.filteredTotal}
          totalLogs={logs.totalLogs}
          currentPage={logs.currentPage}
          totalPages={logs.totalPages}
          pageSize={logs.pageSize}
          pageInputValue={logs.pageInputValue}
          pageSizeOptions={logs.pageSizeOptions}
          pageStart={logs.pageStart}
          searchValue={logs.searchValue}
          groupFilter={logs.groupFilter}
          nameFilter={logs.nameFilter}
          actorFilter={logs.actorFilter}
          statusFilter={logs.statusFilter}
          sortFilter={logs.sortFilter}
          availableNames={logs.availableNames}
          actorOptions={logs.actorOptions}
          onSearchChange={logs.setSearchValue}
          onGroupFilterChange={logs.setGroupFilter}
          onNameFilterChange={logs.setNameFilter}
          onActorFilterChange={logs.setActorFilter}
          onStatusFilterChange={logs.setStatusFilter}
          onSortFilterChange={logs.setSortFilter}
          onPageInputChange={logs.setPageInputValue}
          onPageSizeChange={logs.setPageSize}
          onPageChange={logs.syncPage}
        />
      </div>

      <ExportDialog
        open={logs.exportOpen}
        exportScope={logs.exportScope}
        exportGroups={logs.exportGroups}
        exportCustomStart={logs.exportCustomStart}
        exportCustomEnd={logs.exportCustomEnd}
        loading={logs.isExporting}
        onClose={() => {
          if (!logs.isExporting) {
            logs.setExportOpen(false);
          }
        }}
        onChangeScope={logs.setExportScope}
        onToggleGroup={(group) =>
          logs.setExportGroups((prev) => ({
            ...prev,
            [group]: !prev[group],
          }))
        }
        onChangeCustomStart={logs.setExportCustomStart}
        onChangeCustomEnd={logs.setExportCustomEnd}
        onSubmit={logs.handleExport}
      />
    </>
  );
}
