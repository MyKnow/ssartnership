import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import MattermostSenderManager from "@/components/admin/MattermostSenderManager";
import {
  AdminCertificationCardPreviewGrid,
  AdminCohortCardThemeManager,
} from "@/components/admin/cohort-card-themes/AdminCohortCardThemeManager";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import StatsRow from "@/components/ui/StatsRow";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminFormAction } from "@/components/admin/admin-form-actions";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";
import type { MattermostSenderMetadata } from "@/lib/mattermost-senders/types";
import type {
  SsafyCycleOverview,
  SsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { formatSsafyMemberLifecycleLabel } from "@/lib/ssafy-year";

function statusMessage(status?: string | null) {
  if (status === "updated") return "기준값을 저장했습니다.";
  if (status === "early-started") return "조기 시작이 적용되었습니다.";
  if (status === "restored") return "자동 계산으로 복구했습니다.";
  if (status === "theme-saved") return "기수별 카드 색상을 저장했습니다.";
  if (status === "theme-deleted") return "기수별 카드 색상을 삭제했습니다.";
  if (status === "mattermost-sender-saved") return "Mattermost Sender 후보를 암호화해 저장했습니다. 테스트 DM 성공 후 활성화해 주세요.";
  if (status === "mattermost-sender-activated") return "테스트 DM이 성공해 Mattermost Sender를 활성화했습니다.";
  if (status === "mattermost-sender-disabled") return "Mattermost Sender를 비활성화하고 자격 증명을 삭제했습니다.";
  return status ? "기수 관리 작업을 완료했습니다." : null;
}

export default function AdminCycleView({
  settings,
  overview,
  themes,
  currentSemester,
  initialTimestamp,
  status,
  errorMessage,
  updateSettingsAction,
  earlyStartAction,
  restoreAction,
  upsertThemeAction,
  deleteThemeAction,
  mattermostSenders,
  mattermostSenderLoadError,
  saveMattermostSenderAction,
  testMattermostSenderAction,
  disableMattermostSenderAction,
}: {
  settings: SsafyCycleSettings;
  overview: SsafyCycleOverview;
  themes: CohortCardTheme[];
  currentSemester: 1 | 2;
  initialTimestamp: string;
  status?: string | null;
  errorMessage?: string | null;
  updateSettingsAction: AdminFormAction;
  earlyStartAction: AdminFormAction;
  restoreAction: AdminFormAction;
  upsertThemeAction: AdminFormAction;
  deleteThemeAction: AdminFormAction;
  mattermostSenders?: MattermostSenderMetadata[];
  mattermostSenderLoadError?: boolean;
  saveMattermostSenderAction?: AdminFormAction;
  testMattermostSenderAction?: AdminFormAction;
  disableMattermostSenderAction?: AdminFormAction;
}) {
  const overrideActive = settings.manualCurrentYear !== null;
  const currentYearLabel = `${overview.currentYear}기`;
  const studentLabels = overview.studentYears.map((year) =>
    formatSsafyMemberLifecycleLabel(year),
  );
  const cardThemeYears = Array.from(
    new Set([
      overview.currentYear,
      ...overview.studentYears,
      overview.graduateThresholdYear,
    ].filter((year) => year > 0)),
  );

  return (
    <div className="grid gap-6">
      <AdminPageHeader eyebrow="Cycle" title="기수 계산 기준 관리" description="기수 전환 기준, 기수별 인증 카드 색상, 카드 목업을 한 화면에서 관리합니다." />
      <StatsRow
        items={[
          { label: "현재 기수", value: currentYearLabel, hint: `${currentSemester}학기 기준` },
          { label: "자동/수동", value: overrideActive ? "수동" : "자동", hint: overrideActive ? "조기 시작 적용 중" : "날짜 기준 계산" },
          { label: "교육생 범위", value: studentLabels.join(" · "), hint: "현재 활성 교육생 구간" },
        ]}
        minItemWidth="13rem"
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] 2xl:items-start">
        <Card tone="elevated" className="grid gap-5">
          <AdminSectionHeading title="현재 기준과 예정 작업" description="기수 전환 기준과 현재 계산 결과를 확인합니다." />
          {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
          {statusMessage(status) ? <FormMessage variant="muted">{statusMessage(status)}</FormMessage> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
              <p className="ui-kicker">현재 계산</p>
              <p className="mt-3 text-2xl font-semibold text-foreground">{currentYearLabel} · {currentSemester}학기</p>
              <p className="mt-2 text-sm text-muted-foreground">{overrideActive ? "조기 시작 수동 기준" : "날짜 기준 자동 계산"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
              <p className="ui-kicker">현재 범위</p>
              <p className="mt-3 text-sm font-semibold text-foreground">교육생 {studentLabels.join(" · ")}</p>
              <p className="mt-2 text-sm text-muted-foreground">수료생 {overview.graduateThresholdYear}기 이하 · 운영진 0기</p>
            </div>
          </div>
          <div className="grid gap-3 rounded-3xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">작업 예정사항</p>
            <p>다음 1학기 시작: {overview.nextSemesterStartLabel}</p>
            <p>다음 2학기 / 새 기수 시작: {overview.nextCohortStartLabel}</p>
            <p>수료 전환: {overview.graduateThresholdYear}기 이하</p>
          </div>
        </Card>

        <Card tone="elevated" className="grid gap-5 2xl:sticky 2xl:top-24">
          <AdminSectionHeading title="기준값 수정" description="기준 기수와 시작 시점을 조정하고 조기 시작 또는 복구를 실행합니다." />
          <form action={updateSettingsAction} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-foreground">기준 기수<Input type="number" name="anchorYear" min={1} max={99} defaultValue={settings.anchorYear} /></label>
              <label className="grid gap-2 text-sm font-medium text-foreground">기준 연도<Input type="number" name="anchorCalendarYear" min={2000} max={3000} defaultValue={settings.anchorCalendarYear} /></label>
              <label className="grid gap-2 text-sm font-medium text-foreground">기준 월<Input type="number" name="anchorMonth" min={1} max={12} defaultValue={settings.anchorMonth} /></label>
            </div>
            <SubmitButton pendingText="저장 중">기준값 저장</SubmitButton>
          </form>
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={earlyStartAction}><SubmitButton variant="ghost" pendingText="적용 중" className="w-full">조기 시작</SubmitButton></form>
            <form action={restoreAction}><SubmitButton variant="danger" pendingText="복구 중" className="w-full">복구</SubmitButton></form>
          </div>
          <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">현재 적용 상태</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={overrideActive ? "success" : "neutral"}>{overrideActive ? "조기 시작 적용 중" : "자동 계산"}</Badge>
              <Badge variant="neutral">현재 {currentYearLabel}</Badge>
              <Badge variant="neutral">{currentSemester}학기</Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6">
        {mattermostSenders && saveMattermostSenderAction && testMattermostSenderAction && disableMattermostSenderAction ? (
          <MattermostSenderManager
            senders={mattermostSenders}
            loadError={mattermostSenderLoadError}
            saveAction={saveMattermostSenderAction}
            testAction={testMattermostSenderAction}
            disableAction={disableMattermostSenderAction}
          />
        ) : null}
        <AdminCohortCardThemeManager themes={themes} suggestedYears={cardThemeYears} upsertAction={upsertThemeAction} deleteAction={deleteThemeAction} />
        <AdminCertificationCardPreviewGrid themes={themes} initialTimestamp={initialTimestamp} />
      </div>
    </div>
  );
}
